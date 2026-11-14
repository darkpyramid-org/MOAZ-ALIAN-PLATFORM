/**
 * The only place the wall clock is read (port of Infrastructure.Time.SystemClock).
 * Kept behind a function so tests can freeze time by monkey-patching.
 */
export function utcNow(): Date {
  return new Date();
}
