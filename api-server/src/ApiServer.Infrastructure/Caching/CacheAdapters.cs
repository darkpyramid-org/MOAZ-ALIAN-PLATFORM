using ApiServer.Application.Abstractions;
using Microsoft.Extensions.Caching.Memory;

namespace ApiServer.Infrastructure.Caching;

/// <summary>
/// <see cref="IMemoryCache"/> adapter for the application's read-through port. Entries are
/// absolute-expiring and each counts as one against the configured size limit, so the cache
/// cannot grow without bound under query-string probing.
/// </summary>
public sealed class MemoryReadThroughCache(IMemoryCache cache) : IReadThroughCache
{
    public Task<T?> TryGetAsync<T>(string key, CancellationToken cancellationToken)
        where T : class
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(cache.TryGetValue<T>(key, out var value) ? value : null);
    }

    public Task SetAsync<T>(string key, T value, TimeSpan timeToLive, CancellationToken cancellationToken)
        where T : class
    {
        cancellationToken.ThrowIfCancellationRequested();

        cache.Set(
            key,
            value,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = timeToLive,
                Size = 1,
            });

        return Task.CompletedTask;
    }
}

/// <summary>
/// In-process generation counter behind content cache keys. Writes bump it; readers fold the
/// current value into their key, so invalidation is one atomic increment rather than a scan.
/// Replace with a shared token only when running more than one instance.
/// </summary>
public sealed class InProcessContentCacheVersion : IContentCacheVersion
{
    private long _current = 1;

    public long Current => Volatile.Read(ref _current);

    public void Bump() => _ = Interlocked.Increment(ref _current);
}
