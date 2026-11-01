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

    /// <summary>Where to send the browser after a successful OAuth callback.</summary>
    public string FrontendUrl { get; set; } = "http://localhost:8080";

    public string RolesMetadataClaimType { get; set; } = "app_metadata";

    /// <summary>OAuth provider configuration. Empty/unconfigured providers are disabled.</summary>
    public Dictionary<string, OAuthProviderOptions> OAuth { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public sealed class OAuthProviderOptions
    {
        public string? ClientId { get; set; }
        public string? ClientSecret { get; set; }
        public string? RedirectUri { get; set; }
        public string? AuthorizationEndpoint { get; set; }
        public string? TokenEndpoint { get; set; }
        public string? UserInfoEndpoint { get; set; }
        public string Scope { get; set; } = "openid email profile";

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(ClientId)
            && !string.IsNullOrWhiteSpace(ClientSecret)
            && !string.IsNullOrWhiteSpace(RedirectUri);
    }

    public string ResolveIssuer()
    {
        if (!string.IsNullOrWhiteSpace(Issuer))
        {
            return Issuer.TrimEnd('/');
        }

        return "http://localhost:5199";
    }
}
