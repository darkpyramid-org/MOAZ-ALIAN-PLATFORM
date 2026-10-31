/** Valid storage object paths for /api/media/$ (bucket-prefixed). */
export const OBJECT_PATH_RE = /^media\/[\w][\w./-]*$/;

export function isValidMediaObjectPath(path: string): boolean {
  return OBJECT_PATH_RE.test(path);
}
