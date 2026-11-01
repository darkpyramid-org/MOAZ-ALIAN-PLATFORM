namespace ApiServer.Application.Abstractions;

/// <summary>
/// Monotonic token embedded in every content cache key. A write bumps it, which makes all
/// previously keyed entries unreachable in one operation — no per-key eviction bookkeeping.
/// <para>
/// The shipped implementation is in-process. On a multi-instance deployment either swap this
/// for a shared token (Redis, DB row) or keep the TTL short; cache entries expire on their own,
/// so a stale token can only delay visibility, never make it permanent.
/// </para>
/// </summary>
public interface IContentCacheVersion
{
    long Current { get; }

    void Bump();
}
