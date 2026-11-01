using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ApiServer.Infrastructure.Auth;

/// <summary>
/// Configures JWT Bearer authentication and authorization for the API.
/// </summary>
public static class JwtAuthentication
{
    public static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var authSection = configuration.GetSection(AuthOptions.SectionName);
        services.Configure<AuthOptions>(authSection);

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();

        services.AddSingleton<IConfigureOptions<JwtBearerOptions>, ConfigureBearerOptions>();
        services.AddAuthorization();
        return services;
    }

    private sealed class ConfigureBearerOptions(
        IOptions<AuthOptions> authOptions) : IConfigureNamedOptions<JwtBearerOptions>
    {
        public void Configure(string? name, JwtBearerOptions options)
        {
            if (name != JwtBearerDefaults.AuthenticationScheme)
            {
                return;
            }

            ConfigureBearer(options, authOptions.Value);
        }

        public void Configure(JwtBearerOptions options) => Configure(JwtBearerDefaults.AuthenticationScheme, options);
    }

    private static void ConfigureBearer(
        JwtBearerOptions options,
        AuthOptions settings)
    {
        var secret = settings.JwtSecret;

        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = settings.RequireHttpsMetadata;

        var validation = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers = [settings.ResolveIssuer()],
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
            validation.IssuerSigningKey = new SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(secret));
        }

        options.TokenValidationParameters = validation;
    }
}

