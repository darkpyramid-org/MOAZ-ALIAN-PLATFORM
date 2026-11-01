using ApiServer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ApiServer.Infrastructure.Persistence;

/// <summary>
/// The single PostgreSQL-backed context for the library. Owned entirely by Infrastructure:
/// no other layer references <see cref="DbContext"/>.
/// </summary>
public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    /// <summary>
    /// All API tables live in the <c>library</c> schema. The Supabase project's <c>public</c>
    /// schema already holds the frontend's own tables (<c>content_items</c> as jsonb, chat,
    /// debates, ...); an isolated schema lets the API and that data coexist without a name
    /// collision and keeps PostgREST (which serves <c>public</c> only) out of the API's tables.
    /// </summary>
    public const string Schema = "library";

    public DbSet<ContentItem> ContentItems => Set<ContentItem>();

    public DbSet<Category> Categories => Set<Category>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema(Schema);

        // One pass over the assembly's IEntityTypeConfiguration implementors keeps mapping
        // files discoverable and the context itself free of table noise.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}
