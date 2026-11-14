import { Router } from 'express';
import { bindEnumBody, parseOptionalBool, parseOptionalInt, type EnumFieldSpec, type FieldSpec } from '../middleware/body.js';
import { requireEditor } from '../middleware/auth.js';
import { editorialRateLimit } from '../middleware/rateLimit.js';
import { sendJson, sendCreated, sendNoContent } from '../lib/http.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import {
  DEFAULT_PAGE_SIZE,
  CONTENT_SORTS,
  normalizeQuery,
  parseQueryEnum,
} from '../domain/query.js';
import { CONTENT_TYPE_NAMES, CONTENT_TYPE_CLR_NAMES, CONTENT_TYPES } from '../domain/enums.js';
import { validateContentQuery } from '../domain/validators.js';
import * as contentService from '../services/contentService.js';

/**
 * /api/content — the port of ContentEndpoints.cs: the public library plus the
 * dashboard's content management. The read side mirrors the original's query
 * translation step by step (binder → enum parse → FluentValidation →
 * normalisation), because the exact failure order is pinned by the battery.
 */

const router = Router();

// Enum specs for the write binder — camelCase names in declaration order.
const TYPE_ENUM: EnumFieldSpec = {
  key: 'type',
  kind: 'enum',
  names: [...CONTENT_TYPE_NAMES],
  values: [...CONTENT_TYPES],
  required: true,
};

const ENUM_FIELDS: (FieldSpec | EnumFieldSpec)[] = [
  TYPE_ENUM,
  { key: 'slug', kind: 'string' },
  { key: 'title', kind: 'string', required: true },
  { key: 'description', kind: 'string' },
  { key: 'thumbnailUrl', kind: 'string' },
  { key: 'authorName', kind: 'string' },
  { key: 'sourceUrl', kind: 'string' },
  { key: 'body', kind: 'string' },
  { key: 'categoryIds', kind: 'stringArray' },
  { key: 'tags', kind: 'stringArray' },
  { key: 'featured', kind: 'boolean' },
  { key: 'verified', kind: 'boolean' },
  { key: 'demo', kind: 'boolean' },
  { key: 'rightsStatus', kind: 'enum', names: ['owned', 'licensed', 'external', 'unknown'], values: [1, 2, 3, 4] },
  { key: 'publishedAt', kind: 'date' },
  { key: 'videoId', kind: 'string' },
  { key: 'videoProvider', kind: 'enum', names: ['youtube'], values: [1] },
  { key: 'durationSeconds', kind: 'number' },
  { key: 'seriesName', kind: 'string' },
  { key: 'coverUrl', kind: 'string' },
  { key: 'publisher', kind: 'string' },
  { key: 'isbn', kind: 'string' },
  { key: 'publicationYear', kind: 'number' },
  { key: 'availability', kind: 'enum', names: ['digital', 'print', 'unknown'], values: [1, 2, 3] },
  { key: 'authorizedLinks', kind: 'linksArray' },
  { key: 'readingTimeMinutes', kind: 'number' },
  { key: 'references', kind: 'stringArray' },
  { key: 'documentUrl', kind: 'string' },
  { key: 'documentFormat', kind: 'string' },
];

// CLR member names — Enum.TryParse accepts them too (any casing).
const SORT_CLR_NAMES = ['Newest', 'Oldest', 'Title', 'Relevance'] as const;

router.get('/api/content', (req, res, next) => {
  try {
    const query = req.query as Record<string, string | string[] | undefined>;
    const single = (name: string): string | undefined => {
      const value = query[name];
      return Array.isArray(value) ? value[0] : value;
    };

    // int?/bool? binding failures (page=abc, featured=maybe) throw out of the
    // binder and become the generic 500 problem — same as ASP.NET's
    // BadHttpRequestException path.
    const page = parseOptionalInt(single('page'));
    const pageSize = parseOptionalInt(single('pageSize'));
    const featured = parseOptionalBool(single('featured'));
    const demo = parseOptionalBool(single('demo'));

    const typeResult = parseQueryEnum(
      'type',
      single('type'),
      [...CONTENT_TYPE_NAMES],
      CONTENT_TYPES as unknown as (1 | 2 | 3 | 4)[],
      [...CONTENT_TYPE_CLR_NAMES],
    );
    const sortResult = parseQueryEnum(
      'sort',
      single('sort'),
      [...CONTENT_SORTS],
      [0, 1, 2, 3],
      [...SORT_CLR_NAMES],
    );

    // Enum parse failures surface as a field-level 400 whose errors dict uses
    // the lowercase query key, exactly like ParseEnum's ValidationFailure.
    const fieldErrors: Record<string, string[]> = {};
    if (!typeResult.ok) fieldErrors['type'] = [typeResult.message ?? ''];
    if (!sortResult.ok) fieldErrors['sort'] = [sortResult.message ?? ''];
    if (Object.keys(fieldErrors).length > 0) {
      throw new ValidationError(fieldErrors);
    }

    const search = single('search') ?? null;
    // FluentValidation runs on the RAW (untrimmed) search, before the query is
    // normalised — the length error reports the caller's exact character count.
    validateContentQuery(search);

    const normalized = normalizeQuery({
      type: typeResult.value,
      categoryId: single('categoryId') ?? null,
      search,
      series: single('series') ?? null,
      featured: featured ?? null,
      demo: demo ?? null,
      sort: (sortResult.value ?? 0) as 0 | 1 | 2 | 3,
      page: page ?? 1,
      pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
    });

    contentService
      .listPage({
        type: normalized.type,
        categoryId: normalized.categoryId,
        search: normalized.search,
        series: normalized.series,
        featured: normalized.featured,
        demo: normalized.demo,
        sort: normalized.sort,
        page: normalized.page,
        pageSize: normalized.pageSize,
      })
      .then((result) => sendJson(res, 200, result))
      .catch(next);
  } catch (error) {
    next(error);
  }
});

router.get('/api/content/counts', (_req, res, next) => {
  contentService
    .counts()
    .then((result) => sendJson(res, 200, result))
    .catch(next);
});

router.get('/api/content/snapshot', (_req, res, next) => {
  contentService
    .snapshotAll()
    .then((result) => sendJson(res, 200, result))
    .catch(next);
});

router.get('/api/content/:type/:slug', (req, res, next) => {
  try {
    const typeSegment = String(req.params['type'] ?? '').toLowerCase();
    const contentType = parseType(typeSegment);
    if (contentType === undefined) {
      // An unrecognised type segment is simply not a resource that exists.
      throw new NotFoundError('Content type', typeSegment);
    }
    contentService
      .getBySlug(contentType, String(req.params['slug'] ?? ''))
      .then((item) => sendJson(res, 200, item))
      .catch(next);
  } catch (error) {
    next(error);
  }
});

/** The API's own names plus the plural segments the frontend routes use. */
function parseType(value: string): 1 | 2 | 3 | 4 | undefined {
  switch (value) {
    case 'video':
    case 'videos':
      return 1;
    case 'book':
    case 'books':
      return 2;
    case 'article':
    case 'articles':
      return 3;
    case 'research':
      return 4;
    default:
      return undefined;
  }
}

router.post('/api/content', requireEditor, editorialRateLimit, (req, res, next) => {
  try {
    const bound = bindEnumBody(req, ENUM_FIELDS);
    contentService
      .createContent(bound, req.auth ?? undefined)
      .then((created) => {
        // Headers must be ASCII and Arabic slugs are not; the Location value
        // gets the same percent-encoding a browser would put in the path.
        // The DTO's type is already the lowercase segment name.
        const typeSegment = String(created['type'] ?? '');
        const slug = String(created['slug'] ?? '');
        sendCreated(res, `/api/content/${typeSegment}/${encodeURIComponent(slug)}`, created);
      })
      .catch(next);
  } catch (error) {
    next(error);
  }
});

router.put('/api/content/:id', requireEditor, editorialRateLimit, (req, res, next) => {
  try {
    const bound = bindEnumBody(req, ENUM_FIELDS);
    contentService
      .updateContent(String(req.params['id'] ?? ''), bound, req.auth ?? undefined)
      .then((updated) => sendJson(res, 200, updated))
      .catch(next);
  } catch (error) {
    next(error);
  }
});

router.delete('/api/content/:id', requireEditor, editorialRateLimit, (req, res, next) => {
  contentService
    .deleteContent(String(req.params['id'] ?? ''), req.auth ?? undefined)
    .then(() => sendNoContent(res))
    .catch(next);
});

export const contentRoutes = router;
