import { Prisma } from '@prisma/client';
import { db } from '../lib/db.js';
import { env } from '../config/env.js';
import { ReadThroughCache } from '../lib/cache.js';
import { bumpVersion, currentVersion } from './cacheVersion.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import {
  guardRequired,
  guardOptional,
} from '../lib/guard.js';
import { utcNow } from '../lib/clock.js';
import { netTimestamp } from '../lib/netjson.js';
import type { Caller } from './caller.js';

/**
 * Category use cases — the port of Application.Services.CategoryService.
 * Writes share the content cache token (bumping the same version) because a
 * category rename or a content edit both change what the category list shows.
 */

const cache = new ReadThroughCache(20_000, env.CONTENT_CACHE_ENABLED);

const COUNTS_TTL_MS = env.CONTENT_CACHE_COUNTS_TTL_MS;

export interface CategoryJson {
  [key: string]: unknown;
}

function categoryJson(row: {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  contentCount: number;
  createdAt: Date;
  updatedAt: Date;
}): CategoryJson {
  // Key order mirrors the CategoryDto declaration order the wire carries;
  // timestamps print in the .NET DateTimeOffset format.
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    contentCount: row.contentCount,
    createdAt: netTimestamp(row.createdAt),
    updatedAt: netTimestamp(row.updatedAt),
  };
}

async function loadList(): Promise<CategoryJson[]> {
  // The correlated COUNT the EF projection generated, expressed as one LEFT
  // JOIN + GROUP BY — a few dozen rows, so no aggregate is materialised.
  const rows = await db.$queryRaw<
    { Id: string; Name: string; Description: string; SortOrder: number; CreatedAt: Date; UpdatedAt: Date; ContentCount: number }[]
  >(
    Prisma.raw(`
        SELECT c."Id", c."Name", c."Description", c."SortOrder", c."CreatedAt", c."UpdatedAt",
               COUNT(cic."ContentItemsId")::int AS "ContentCount"
        FROM "library"."categories" c
        LEFT JOIN "library"."content_item_categories" cic ON cic."CategoriesId" = c."Id"
        GROUP BY c."Id", c."Name", c."Description", c."SortOrder", c."CreatedAt", c."UpdatedAt"
        ORDER BY c."SortOrder", c."Name"
    `),
  );
  return rows.map((row) =>
    categoryJson({
      id: row.Id,
      name: row.Name,
      description: row.Description,
      sortOrder: row.SortOrder,
      contentCount: row.ContentCount,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
    }),
  );
}

export async function listCategories(): Promise<CategoryJson[]> {
  const key = `categories:list:v${currentVersion()}`;
  const cached = cache.tryGet<CategoryJson[]>(key);
  if (cached !== undefined) return cached;

  const all = await loadList();
  cache.set(key, all, COUNTS_TTL_MS);
  return all;
}

export async function getCategory(id: string): Promise<CategoryJson> {
  // Categories are a few dozen rows and the list is cached, so picking from it
  // beats a second nearly identical projection.
  const all = await listCategories();
  const found = all.find((category) => category['id'] === id);
  if (found === undefined) {
    throw new NotFoundError('Category', id);
  }
  return found;
}

function requireEditor(caller: Caller | undefined): void {
  if (caller === undefined || !caller.canEditContent) {
    throw new ForbiddenError('Managing categories requires an admin or editor role.');
  }
}

export interface CategoryWriteInput {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export async function createCategory(input: CategoryWriteInput, caller: Caller | undefined): Promise<CategoryJson> {
  requireEditor(caller);

  const id = input.id.trim();
  if (await db.category.findUnique({ where: { id }, select: { id: true } }) !== null) {
    throw new ConflictError(`Category '${id}' already exists.`);
  }

  // The aggregate guards still run — the HTTP validator only mirrors them.
  const name = guardRequired(input.name, 'Category name', 120);
  const description = guardOptional(input.description, 1000, 'Category description') ?? '';
  const now = utcNow();

  await db.category.create({
    data: { id, name, description, sortOrder: input.sortOrder, createdAt: now, updatedAt: now },
  });
  bumpVersion();
  return getCategory(id);
}

export async function updateCategory(
  routeId: string,
  input: CategoryWriteInput,
  caller: Caller | undefined,
): Promise<CategoryJson> {
  requireEditor(caller);

  const existing = await db.category.findUnique({ where: { id: routeId } });
  if (existing === null) {
    throw new NotFoundError('Category', routeId);
  }

  // The id is how content records address their category; letting it change
  // would silently move published material between sections.
  if (input.id.trim() !== routeId) {
    throw new ConflictError('A category id cannot be changed. Create a new category and move the content.');
  }

  const name = guardRequired(input.name, 'Category name', 120);
  const description = guardOptional(input.description, 1000, 'Category description') ?? '';
  const now = utcNow();

  await db.category.update({
    where: { id: routeId },
    data: { name, description, sortOrder: input.sortOrder, updatedAt: now },
  });
  bumpVersion();
  return getCategory(routeId);
}

export async function deleteCategory(id: string, caller: Caller | undefined): Promise<void> {
  requireEditor(caller);

  const existing = await db.category.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) {
    throw new NotFoundError('Category', id);
  }

  const linked = await db.contentItemCategory.count({ where: { categoriesId: id } });
  if (linked > 0) {
    throw new ConflictError(`Category '${id}' still has content records. Move them first.`);
  }

  await db.category.delete({ where: { id } });
  bumpVersion();
}
