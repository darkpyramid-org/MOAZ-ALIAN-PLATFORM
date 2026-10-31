/** Valid storage object paths for /api/media/$ (bucket-prefixed). */
export const OBJECT_PATH_RE = /^media\/[\w][\w./-]*$/;

export function isValidMediaObjectPath(path: string): boolean {
  if (!OBJECT_PATH_RE.test(path)) {
    return false;
  }

  const segments = path.split("/");
  return (
    segments[0] === "media" &&
    segments.slice(1).every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}
