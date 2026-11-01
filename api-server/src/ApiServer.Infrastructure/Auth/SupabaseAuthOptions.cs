namespace ApiServer.Infrastructure.Auth;

/// <summary>
/// Connection points to the Supabase project that signs the access tokens the frontend already
/// holds. Every field has a sane default for a standard Supabase project; nothing here needs
/// editing unless the space is custom-hosted.
/// </summary>
public sealed class SupabaseAuthOptions
{
    public const string SectionName = "SupabaseAuth";

    /// <summary>Project base URL, e.g. <c>https://abcdefgh.supabase.co</c>.</summary>
    public string ProjectUrl { get; set; } = string.Empty;

    /// <summary>
    /// Expected <c>iss</c>. When omitted it is derived as <c>{ProjectUrl}/auth/v1</c>, which is
    /// the issuer hosted GoTrue stamps into access tokens. Set this explicitly if
    /// <c>401 invalid_issuer</c> appears in the logs.
    /// </summary>
    public string? Issuer { get; set; }

    /// <summary>
    /// The project's <c>SUPABASE_JWT_SECRET</c>. Legacy Supabase projects sign every access
    /// token with HMAC-SHA256 using this secret; when it is configured the API validates
    /// against it directly and never needs the JWKS endpoint. Leave it unset (use environment
    /// variables or user-secrets, never committed files) for newer projects that use
    /// asymmetric ES256 keys published at <c>{issuer}/.well-known/jwks.json</c>.
    /// </summary>
    public string? JwtSecret { get; set; }

    /// <summary>JWKS endpoint. Defaults to <c>{Issuer}/.well-known/jwks.json</c>.</summary>
    public string? JwksUri { get; set; }

    /// <summary>Supabase access tokens carry <c>aud = "authenticated"</c>.</summary>
    public string Audience { get; set; } = "authenticated";

    /// <summary>Keep true everywhere except a local emulator.</summary>
    public bool RequireHttpsMetadata { get; set; } = true;

    /// <summary>Tolerance for clock drift between this API and Supabase.</summary>
    public int ClockSkewSeconds { get; set; } = 30;

    /// <summary>Signing keys are rotated by Supabase; refetch on this cadence.</summary>
    public int JwksRefreshMinutes { get; set; } = 60;

    public string AdminRole { get; set; } = "admin";

    public string EditorRole { get; set; } = "editor";

    /// <summary>Supabase's own privileged token role; treated as admin by design.</summary>
    public string ServiceRole { get; set; } = "service_role";

    public string UserIdClaimType { get; set; } = "sub";

    /// <summary>
    /// Where the platform keeps per-user roles. The frontend's <c>user_roles</c> table must be
    /// mirrored into this JSON object on the Supabase user (a database hook is the usual way),
    /// because only claims inside the signed token are trustworthy here.
    /// </summary>
    public string RolesMetadataClaimType { get; set; } = "app_metadata";

    public string ResolveIssuer()
    {
        if (!string.IsNullOrWhiteSpace(Issuer))
        {
            return Issuer.TrimEnd('/');
        }

        if (string.IsNullOrWhiteSpace(ProjectUrl))
        {
            throw new InvalidOperationException(
                $"Either {SectionName}:Issuer or {SectionName}:ProjectUrl must be configured.");
        }

        return string.Concat(ProjectUrl.TrimEnd('/'), "/auth/v1");
    }

    public string ResolveJwksUri()
    {
        if (!string.IsNullOrWhiteSpace(JwksUri))
        {
            return JwksUri;
        }

        return string.Concat(ResolveIssuer(), "/.well-known/jwks.json");
    }
}
