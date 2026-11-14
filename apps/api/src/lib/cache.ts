import { env } from '../config/env.js';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Read-through cache porting IMemoryCache's behaviour: absolute expiry, each
 * entry counts once against a size limit so query-string probing cannot grow
 * the heap without bound, and cache sweeps are lazy (on access + on insert)
 * because a background timer would keep the process from idling.
 *
 * The size limit matches the ASP.NET configuration (20 000 entries); TTLs come
 * from the ContentCache section defaults (45s lists / 2min items / 5min counts).
 */
export class ReadThroughCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxSize = 20_000,
    private readonly enabled = env.CONTENT_CACHE_ENABLED,
  ) {}

  tryGet<T>(key: string): T | undefined {
    if (!this.enabled) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, timeToLiveMs: number): void {
    if (!this.enabled) return;
    if (this.entries.size >= this.maxSize) {
      this.sweep();
    }
    if (this.entries.size >= this.maxSize) {
      // Still full after sweeping live entries: drop the oldest inserted key.
      // Map iteration order is insertion order, so this is FIFO — matching
      // IMemoryCache's behaviour under sustained pressure closely enough for a
      // cache whose only job is softening read load.
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + timeToLiveMs });
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
