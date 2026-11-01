using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ApiServer.Infrastructure.Persistence;

/// <summary>
/// Lets <c>dotnet ef migrations</c> build the model without booting the host. Resolution order:
/// standard config env var, then a local docker-compose Postgres —
/// migration generation never needs environment setup, while real deploys just set one variable.
/// </summary>
public sealed class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public const string LocalConnectionString =
        "Host=localhost;Port=5433;Database=moaz_alian_library;Username=postgres;Password=Local.Postgres.Password_1";

    public ApplicationDbContext CreateDbContext(string[] args)
    {
        ArgumentNullException.ThrowIfNull(args);

        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__Postgres")
            ?? Environment.GetEnvironmentVariable("POSTGRES_URL_NON_POOLING")
            ?? Environment.GetEnvironmentVariable("POSTGRES_URL")
            ?? LocalConnectionString;

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", ApplicationDbContext.Schema))
            .Options;

        return new ApplicationDbContext(options);
    }
}
