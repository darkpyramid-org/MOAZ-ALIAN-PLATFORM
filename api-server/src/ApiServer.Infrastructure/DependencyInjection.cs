using ApiServer.Application.Abstractions;
using ApiServer.Application.Abstractions.Persistence;
using ApiServer.Application.Common;
using ApiServer.Application.Services;
using ApiServer.Infrastructure.Auth;
using ApiServer.Infrastructure.Caching;
using ApiServer.Infrastructure.Persistence;
using ApiServer.Infrastructure.Persistence.Queries;
using ApiServer.Infrastructure.Persistence.Repositories;
using ApiServer.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ApiServer.Infrastructure;

/// <summary>
/// Composition of the outer world: PostgreSQL, memory cache, clock, identity. Every
/// port the Application layer declares gets exactly one adapter here, and this is the
/// only assembly that knows these implementations exist.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        // An empty placeholder is as fatal as a missing one; catching it here beats a 500 on
        // every request that touches the database.
        var connectionString = configuration.GetConnectionString("Postgres") is { Length: > 0 } postgres
            ? postgres
            : throw new InvalidOperationException(
                "Missing connection string 'ConnectionStrings:Postgres'. The API cannot start without its database.");

        services
            .AddDbContext<ApplicationDbContext>(
                options => options
                    .UseNpgsql(
                        connectionString,
                        npgsql =>
                        {
                            // The migration ledger lives with the API's own tables, isolated
                            // from the legacy third-party tables in the public schema.
                            npgsql.MigrationsHistoryTable("__EFMigrationsHistory", ApplicationDbContext.Schema);

                            // Transient network faults against a hosted database are normal;
                            // three short retries beat a failed request or a crashed migration.
                            npgsql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
                        }));

        services.AddScoped<IContentRepository, ContentRepository>();
        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAuthService, AuthService>();

        services.AddSingleton<IClock, SystemClock>();

        // One entry per cache record; the limit bounds memory no matter how many query
        // permutations a client sends.
        services.AddMemoryCache(options => options.SizeLimit = 20_000);
        services.AddSingleton<IReadThroughCache, MemoryReadThroughCache>();
        services.AddSingleton<IContentCacheVersion, InProcessContentCacheVersion>();
        services.Configure<ContentCacheOptions>(configuration.GetSection(ContentCacheOptions.SectionName));

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, ClaimsCurrentUser>();
        services.AddJwtAuthentication(configuration);
        services.AddHttpClient();

        // Liveness of the real dependency, used by /health and container readiness probes.
        services.AddHealthChecks().AddDbContextCheck<ApplicationDbContext>("postgres", tags: ["ready"]);

        return services;
    }
}
