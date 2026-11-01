using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ApiServer.Infrastructure.Auth;

/// <summary>
/// Verifies the access tokens the frontend already holds. The API becomes a pure resource
/// server: Supabase signs, this validates, and no password ever comes near it.
/// </summary>
public static class SupabaseJwtAuthentication
{
    public static IServiceCollection AddSupabaseJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<SupabaseAuthOptions>(configuration.GetSection(SupabaseAuthOptions.SectionName));

        // Fail at startup rather than at the first protected request when config is missing.
        var startupOptions = configuration.GetSection(SupabaseAuthOptions.SectionName).Get<SupabaseAuthOptions>()
            ?? new SupabaseAuthOptions();
        _ = startupOptions.ResolveIssuer();

        // Registered eagerly but used lazily: with the legacy HMAC secret configured the
        // provider is never consulted, and nothing ever hits the network.
        _ = startupOptions.ResolveJwksUri();

        services.AddHttpClient(JwksSigningKeyProvider.HttpClientName)
            .ConfigureHttpClient(client => client.Timeout = TimeSpan.FromSeconds(10));

        services.AddSingleton<JwksSigningKeyProvider>();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();

        // Registered as IConfigureOptions, not IConfigureNamedOptions: OptionsFactory collects
        // the unnamed service type but hands each instance its scheme name, invoking
        // IConfigureNamedOptions.Configure(name, options) when the class implements it.
        // Registering under the named interface alone leaves the action unreferenced — the
        // scheme would then validate against zero signing keys.
        services.AddSingleton<IConfigureOptions<JwtBearerOptions>, ConfigureBearerOptions>();

        services.AddAuthorization();
        return services;
    }

    private sealed class ConfigureBearerOptions(
        IOptions<SupabaseAuthOptions> supabaseOptions,
        JwksSigningKeyProvider signingKeys) : IConfigureNamedOptions<JwtBearerOptions>
    {
        public void Configure(string? name, JwtBearerOptions options)
        {
            if (name != JwtBearerDefaults.AuthenticationScheme)
            {
                return;
            }

            ConfigureBearer(options, supabaseOptions.Value, signingKeys);
        }

        public void Configure(JwtBearerOptions options) => Configure(JwtBearerDefaults.AuthenticationScheme, options);
    }

    private static void ConfigureBearer(
        JwtBearerOptions options,
        SupabaseAuthOptions settings,
        JwksSigningKeyProvider signingKeys)
    {
        var jwksUri = settings.ResolveJwksUri();
        var refreshAfter = TimeSpan.FromMinutes(Math.Max(1, settings.JwksRefreshMinutes));
        var issuerOverride = settings.Issuer;
        var secret = settings.JwtSecret;

        // Supabase claims (sub, app_metadata, role) must reach the API byte-for-byte;
        // inbound claim mapping would rewrite "sub" and friends into ClaimTypes URIs.
        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = settings.RequireHttpsMetadata;

        var validation = new TokenValidationParameters
        {
            ValidateIssuer = true,

            // GoTrue has stamped two different issuers depending on project vintage: the
            // full {ProjectUrl}/auth/v1 and the bare literal "supabase". Both are accepted
            // unless the deployment pins Issuer explicitly; validation always has the
            // audience and signature to stand on either way.
            ValidIssuers = string.IsNullOrWhiteSpace(issuerOverride)
                ? [settings.ResolveIssuer(), "supabase"]
                : [issuerOverride.TrimEnd('/')],

            ValidateAudience = true,
            ValidAudience = settings.Audience,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            RoleClaimType = "role",
            NameClaimType = settings.UserIdClaimType,
            ClockSkew = TimeSpan.FromSeconds(Math.Max(0, settings.ClockSkewSeconds)),
        };

        if (!string.IsNullOrWhiteSpace(secret))
        {
            // Legacy Supabase projects: every access token is HMAC-SHA256 with the shared
            // project secret. One key, no network, no rotation endpoint.
            validation.IssuerSigningKey = new SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(secret));
        }
        else
        {
            // Newer projects sign with ES256 keys served from the JWKS endpoint; the
            // provider matches the token's kid and survives short endpoint outages.
            validation.IssuerSigningKeyResolver = (_, _, keyId, _) => signingKeys.ResolveKeys(keyId, jwksUri, refreshAfter);
        }

        options.TokenValidationParameters = validation;
    }
}
