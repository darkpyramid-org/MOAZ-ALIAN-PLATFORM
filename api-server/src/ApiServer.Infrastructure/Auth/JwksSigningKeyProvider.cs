using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace ApiServer.Infrastructure.Auth;

/// <summary>
/// Fetches and caches the Supabase signing keys, matching them by <c>kid</c>.
/// <para>
/// Chosen over <c>JwtBearerOptions.Authority</c>: hosted GoTrue publishes a bare JWKS document
/// rather than a full OpenID configuration, so the built-in retriever has nothing to bind to.
/// </para>
/// <para>
/// A failed refresh keeps serving the last known keys — a JWKS outage must not log every user
/// out. Token lifetimes are still validated, so the exposure window is bounded by the cache TTL.
/// </para>
/// </summary>
public sealed class JwksSigningKeyProvider(
    IHttpClientFactory httpClientFactory,
    ILogger<JwksSigningKeyProvider> logger) : IDisposable
{
    public const string HttpClientName = "supabase-jwks";

    private readonly SemaphoreSlim _refreshGate = new(1, 1);

    private volatile Cache? _cache;

    /// <summary>
    /// Called from the token validator, which is synchronous by contract. The blocking wait
    /// only ever happens on a cold start or an expired cache; steady-state requests read the
    /// volatile snapshot.
    /// </summary>
    public IReadOnlyList<SecurityKey> ResolveKeys(string? keyId, string jwksUri, TimeSpan refreshAfter)
    {
        var cache = _cache;

        if (cache is null || cache.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            _ = _refreshGate.Wait(TimeSpan.FromSeconds(10));

            try
            {
                cache = _cache;

                // Another request may have refreshed while this one queued on the gate.
                if (cache is null || cache.ExpiresAt <= DateTimeOffset.UtcNow)
                {
                    cache = RefreshAsync(jwksUri, refreshAfter).GetAwaiter().GetResult();
                }
            }
            finally
            {
                _ = _refreshGate.Release();
            }
        }

        return cache.Match(keyId);
    }

    private async Task<Cache> RefreshAsync(string jwksUri, TimeSpan refreshAfter)
    {
        try
        {
            var client = httpClientFactory.CreateClient(HttpClientName);
            var payload = await client.GetStringAsync(jwksUri).ConfigureAwait(false);
            var keySet = new JsonWebKeySet(payload);

            var all = new List<SecurityKey>(keySet.Keys.Count);
            var byKeyId = new Dictionary<string, SecurityKey>(StringComparer.Ordinal);

            foreach (var jsonKey in keySet.Keys)
            {
                // JsonWebKey derives from SecurityKey; no conversion needed.
                all.Add(jsonKey);

                if (!string.IsNullOrEmpty(jsonKey.Kid))
                {
                    _ = byKeyId.TryAdd(jsonKey.Kid, jsonKey);
                }
            }

            var refreshed = new Cache([.. all], byKeyId, DateTimeOffset.UtcNow.Add(refreshAfter));
            _cache = refreshed;

            logger.LogInformation("Loaded {KeyCount} Supabase signing keys from {JwksUri}.", all.Count, jwksUri);
            return refreshed;
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException or TaskCanceledException or FormatException)
        {
            logger.LogWarning(
                exception,
                "Supabase signing-key refresh failed for {JwksUri}; retrying soon and serving the previous keys meanwhile.",
                jwksUri);

            // Short retry window instead of the normal TTL, and never discard usable keys.
            var fallback = _cache ?? Cache.Empty;
            _cache = fallback with { ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(1) };
            return _cache;
        }
    }

    public void Dispose() => _refreshGate.Dispose();

    private sealed record Cache(
        IReadOnlyList<SecurityKey> All,
        IReadOnlyDictionary<string, SecurityKey> ByKeyId,
        DateTimeOffset ExpiresAt)
    {
        public static readonly Cache Empty = new(
            [],
            new Dictionary<string, SecurityKey>(StringComparer.Ordinal),
            DateTimeOffset.MinValue);

        /// <summary>
        /// Exact kid match first. When the kid is unknown (a rotation landing between refreshes)
        /// every cached key is offered, because failing closed would reject all traffic, not just
        /// the rotated tokens.
        /// </summary>
        public IReadOnlyList<SecurityKey> Match(string? keyId) =>
            !string.IsNullOrEmpty(keyId) && ByKeyId.TryGetValue(keyId, out var exact)
                ? [exact]
                : All;
    }
}
