namespace ApiServer.Application.Abstractions;

/// <summary>
/// Read-through cache for hot, rarely-changing public reads (listing pages and detail lookups).
/// The implementation lives in Infrastructure; use cases only decide what is cacheable and for how long.
/// </summary>
public interface IReadThroughCache
{
    /// <summary>Returns a cached value, or null on a miss.</summary>
    Task<T?> TryGetAsync<T>(string key, CancellationToken cancellationToken)
        where T : class;

    Task SetAsync<T>(string key, T value, TimeSpan timeToLive, CancellationToken cancellationToken)
        where T : class;
}
