using ApiServer.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ApiServer.Infrastructure.Persistence.Configurations;

/// <summary>Maps <see cref="Category"/> onto <c>library.categories</c>.</summary>
public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    /// <summary>ICU Arabic collation — see <c>ContentItemConfiguration</c> for the rationale.</summary>
    private const string ArabicTextCollation = "ar-x-icu";

    public void Configure(EntityTypeBuilder<Category> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("categories");

        builder.HasKey(category => category.Id);

        builder.Property(category => category.Id).HasMaxLength(Category.IdMaxLength);

        builder.Property(category => category.Name)
            .HasMaxLength(Category.NameMaxLength)
            .UseCollation(ArabicTextCollation)
            .IsRequired();

        builder.Property(category => category.Description)
            .HasMaxLength(Category.DescriptionMaxLength)
            .UseCollation(ArabicTextCollation);

        builder.Property(category => category.CreatedAt).HasPrecision(3);
        builder.Property(category => category.UpdatedAt).HasPrecision(3);

        // The category rail is ordered by SortOrder then name; this index serves the whole
        // listing in one pass.
        builder.HasIndex(category => new { category.SortOrder, category.Name });
    }
}
