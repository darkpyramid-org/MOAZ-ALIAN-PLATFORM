namespace ApiServer.Infrastructure.Auth;

/// <summary>
/// Authentication and JWT signing/validation configuration.
/// </summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>Expected iss.</summary>
    public string? Issuer { get; set; }

    /// <summary>
    /// Shared secret for signing and verifying HMAC-SHA256 JWT tokens.
    /// </summary>
    public string? JwtSecret { get; set; }

    /// <summary>Audience claim.</summary>
    public string Audience { get; set; } = "authenticated";

    /// <summary>Keep false in local development.</summary>
    public bool RequireHttpsMetadata { get; set; }

    /// <summary>Tolerance for clock drift.</summary>
    public int ClockSkewSeconds { get; set; } = 30;

    public string AdminRole { get; set; } = "admin";

    public string EditorRole { get; set; } = "editor";

    public string ServiceRole { get; set; } = "service_role";

    public string UserIdClaimType { get; set; } = "sub";

    public string RolesMetadataClaimType { get; set; } = "app_metadata";

    public string ResolveIssuer()
    {
        if (!string.IsNullOrWhiteSpace(Issuer))
        {
            return Issuer.TrimEnd('/');
        }

        return "http://localhost:5199";
    }
}
