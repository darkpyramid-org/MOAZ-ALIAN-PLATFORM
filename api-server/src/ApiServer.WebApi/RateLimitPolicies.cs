namespace ApiServer.WebApi;

/// <summary>Named rate-limit policies so endpoints and <c>Program</c> share one vocabulary.</summary>
public static class RateLimitPolicies
{
    /// <summary>Default for anonymous browsing, partitioned per client IP.</summary>
    public const string Public = "public";

    /// <summary>Tighter budget for write calls, partitioned per authenticated user.</summary>
    public const string Editorial = "editorial";
}
