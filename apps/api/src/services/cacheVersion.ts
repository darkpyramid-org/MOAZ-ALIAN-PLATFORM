/**
 * The content cache's epoch. Every write bumps the single process-local
 * counter; all cache keys embed it, so bumping makes every prior entry
 * unreachable without touching the cached values themselves.
 *
 * A process-local counter is correct for the same reason IMemoryCache was:
 * this cache only ever softens reads inside one API process, and a rollout
 * restarts the process — the database remains the source of truth either way.
 */
let current = 1;

export function currentVersion(): number {
  return current;
}

export function bumpVersion(): void {
  current += 1;
}
