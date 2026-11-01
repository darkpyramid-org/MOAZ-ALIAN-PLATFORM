import { supabase } from "@/integrations/supabase/client";
import type { Category, ContentItem } from "@/types/content";
import { toCategory, toContentItem, toUpsertRequest } from "@/lib/api-mapping";
import type { CategoryDto, ContentItemDto } from "@/lib/api-mapping";

export type { CategoryDto, ContentItemDto } from "@/lib/api-mapping";

/**
 * The one place the frontend talks to the ASP.NET library API.
 *
 * Everything the site used to read or write through PostgREST (`content_items`,
 * `categories`) goes through this module instead, so there is exactly one data
 * source and one set of types. Nothing else in `src/` should build an API URL or
 * parse an API response. The shape translation lives in `api-mapping.ts`, which
 * is dependency-free so tests and the identity verifier can run it alone.
 */

/**
 * Server calls (SSR, server functions) read `API_URL`; the browser reads the
 * build-time `VITE_API_URL`. Same fallback order the Supabase client already
 * uses, so one variable per environment is enough.
 */
const RAW_BASE =
  (typeof process !== "undefined" ? process.env["API_URL"] : undefined) ??
  import.meta.env["VITE_API_URL"] ??
  "http://localhost:5199";
const BASE = RAW_BASE.replace(/\/+$/, "");

/** A backend rejection, carrying the field-level messages from its problem details. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** 409 on a write almost always means the slug or id is already taken. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails | null = null;
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    // A non-JSON failure (gateway page, empty body) falls back to the status text.
  }
  return new ApiError(
    problem?.status ?? response.status,
    problem?.detail ??
      problem?.title ??
      response.statusText ??
      `Request failed (${response.status})`,
    problem?.errors ?? {},
  );
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Writes carry the signed-in Supabase session; the API validates it as a JWT. */
async function apiWrite<T>(path: string, method: string, body: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, "الجلسة منتهية، سجّل الدخول من جديد");

  return apiRequest<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Every record, newest first — the pool the public pages hydrate from. */
export async function fetchLibraryItems(): Promise<ContentItem[]> {
  const rows = await apiRequest<ContentItemDto[]>("/api/content/snapshot");
  return rows.map(toContentItem);
}

/** Categories in display order, each with its live content count. */
export async function fetchCategories(): Promise<(Category & { sort_order: number })[]> {
  const rows = await apiRequest<CategoryDto[]>("/api/categories");
  return rows.map(toCategory);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create or replace a record. `existingId` is the id the API issued on a previous
 * save; without it the server generates one, which is why nothing mints ids
 * client-side any more.
 */
export async function saveContentItem(
  item: ContentItem,
  slug: string,
  existingId?: string,
): Promise<ContentItem> {
  const body = toUpsertRequest(item, slug);
  const saved = existingId
    ? await apiWrite<ContentItemDto>(`/api/content/${encodeURIComponent(existingId)}`, "PUT", body)
    : await apiWrite<ContentItemDto>("/api/content", "POST", body);
  return toContentItem(saved);
}

export async function deleteContentItem(id: string): Promise<void> {
  await apiWrite<void>(`/api/content/${encodeURIComponent(id)}`, "DELETE", undefined);
}

export async function saveCategory(
  category: { id: string; name: string; description: string; sortOrder: number },
  existing: boolean,
): Promise<void> {
  const body = {
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
  };
  await apiWrite<CategoryDto>(
    existing ? `/api/categories/${encodeURIComponent(category.id)}` : "/api/categories",
    existing ? "PUT" : "POST",
    body,
  );
}

export async function deleteCategory(id: string): Promise<void> {
  await apiWrite<void>(`/api/categories/${encodeURIComponent(id)}`, "DELETE", undefined);
}
