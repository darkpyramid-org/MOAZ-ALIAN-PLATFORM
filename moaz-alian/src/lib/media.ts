/**
 * Media helpers: uploaded images are stored in the private "media" storage
 * bucket and referenced by their object path (e.g. "media/banner/x.jpg").
 * The app serves them through /api/media/<path>; legacy values stay untouched.
 */

const MEDIA_PATH_RE = /^media\/[\w][\w./-]*$/;

/** True when the value is an uploaded media object path ("media/<path>"). */
export function isMediaPath(value: string | null | undefined): boolean {
  return !!value && MEDIA_PATH_RE.test(value);
}

/**
 * Resolve any stored image reference to a browser-safe URL:
 * - "media/<path>" → "/api/media/media/<path>" (served by the app)
 * - "/images/..." (bundled) or "https://..." (external) → unchanged
 */
export function mediaUrl(value: string | null | undefined, fallback?: string): string {
  if (!value) return fallback ?? "";
  if (isMediaPath(value)) return `/api/media/${value}`;
  return value;
}
