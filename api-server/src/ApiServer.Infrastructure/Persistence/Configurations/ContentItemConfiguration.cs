using System.Text.Json;
using ApiServer.Domain.Common;
using ApiServer.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ApiServer.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the content aggregate onto <c>library.content_items</c>. The mapping mirrors the
/// invariants the domain already enforces, then adds the index set the read path actually uses.
/// </summary>
public sealed class ContentItemConfiguration : IEntityTypeConfiguration<ContentItem>
{
    /// <summary>
    /// ICU Arabic collation, available on any ICU-built PostgreSQL (Supabase included).
    /// Case-insensitive, accent-aware ordering so <c>ORDER BY title</c> matches the frontend's
    /// <c>localeCompare(title, "ar")</c> the way the old SQL Server <c>Arabic_100_CI_AS</c> did.
    /// </summary>
    private const string ArabicTextCollation = "ar-x-icu";

    /// <summary>Same options the API responses use; casing-insensitive property matching is irrelevant here since we control both ends.</summary>
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Content equality for the two JSON-text string collections. Without an explicit comparer EF
    /// falls back to reference equality on the converted value — and because the aggregate mutates
    /// <c>Tags</c> and <c>References</c> in place (<c>Clear()</c> then re-<c>Add()</c>, never a new
    /// list), the tracked snapshot and the live property are the same object. Every tag edit would
    /// then look unchanged and be silently dropped from the UPDATE.
    /// The snapshot delegate copies for exactly that reason; the hash is only ever compared within
    /// one process, so the runtime's randomised string hash is safe here.
    /// </summary>
    private static readonly ValueComparer<ICollection<string>> StringCollectionComparer = new(
        static (left, right) => left != null && right != null && left.SequenceEqual(right),
        static value => value.Aggregate(0, static (hash, item) => HashCode.Combine(hash, item)),
        static value => value.ToList());

    public void Configure(EntityTypeBuilder<ContentItem> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("content_items");

        builder.HasKey(item => item.Id);

        builder.Property(item => item.Id).HasMaxLength(ContentItem.IdMaxLength);

        builder.Property(item => item.Slug).HasMaxLength(Slugs.MaxLength).IsRequired();

        builder.Property(item => item.Title)
            .HasMaxLength(ContentItem.TitleMaxLength)
            .UseCollation(ArabicTextCollation)
            .IsRequired();

        builder.Property(item => item.Description)
            .HasMaxLength(ContentItem.DescriptionMaxLength)
            .UseCollation(ArabicTextCollation);

        // Unbounded text maps to Postgres `text`: the cap still guards request size upstream,
        // and a varchar(100000) would only add length checks with no storage benefit.
        builder.Property(item => item.Body);

        builder.Property(item => item.AuthorName).HasMaxLength(200).UseCollation(ArabicTextCollation);
        builder.Property(item => item.Publisher).HasMaxLength(200);
        builder.Property(item => item.SeriesName).HasMaxLength(200).UseCollation(ArabicTextCollation);
        builder.Property(item => item.Isbn).HasMaxLength(20);
        builder.Property(item => item.DocumentFormat).HasMaxLength(20);
        builder.Property(item => item.VideoId).HasMaxLength(64);

        foreach (var url in new[] { nameof(ContentItem.ThumbnailUrl), nameof(ContentItem.SourceUrl), nameof(ContentItem.CoverUrl), nameof(ContentItem.DocumentUrl) })
        {
            _ = builder.Property(url).HasMaxLength(2048);
        }

        // Enumerations as smallint: Postgres has no one-byte integer, and int2 is the narrowest
        // integral column available for the values in the 1..4 range sitting inside composite
        // indexes. Nullable members are lifted to int2 NULL by EF automatically.
        builder.Property(item => item.Type).HasConversion<short>();
        builder.Property(item => item.RightsStatus).HasConversion<short>();
        builder.Property(item => item.VideoProvider).HasConversion<short>();
        builder.Property(item => item.Availability).HasConversion<short>();

        foreach (var timestamp in new[] { nameof(ContentItem.CreatedAt), nameof(ContentItem.UpdatedAt), nameof(ContentItem.PublishedAt) })
        {
            // timestamptz(3): millisecond resolution is all the UI renders; Npgsql stores the
            // instant in UTC either way, and the precision keeps indexes marginally narrower.
            _ = builder.Property(timestamp).HasPrecision(3);
        }

        // Tags and references travel as JSON text: they are never joined on, always read as a
        // unit, and a link table would multiply row counts for pure display data. The converter
        // is explicit rather than EF9's collection-to-JSON sugar because the aggregate exposes
        // these as ICollection<T>, which EF's ToJson() extension does not bind to. `text` is
        // Postgres' unbounded-varchar; the domain caps count and element length before insert.
        builder.Property(item => item.Tags)
            .HasConversion(
                static values => JsonSerializer.Serialize(values, SerializerOptions),
                static text => JsonSerializer.Deserialize<List<string>>(text, SerializerOptions) ?? new List<string>())
            .Metadata.SetValueComparer(StringCollectionComparer);

        builder.Property(item => item.References)
            .HasConversion(
                static values => JsonSerializer.Serialize(values, SerializerOptions),
                static text => JsonSerializer.Deserialize<List<string>>(text, SerializerOptions) ?? new List<string>())
            .Metadata.SetValueComparer(StringCollectionComparer);

        // Owned links become one jsonb column on this table: Postgres stores it natively,
        // the aggregate still loads it as objects, and the read path never leaves the row.
        // The values live inside the JSON document, so no relational column options apply.
        builder.OwnsMany(
            item => item.AuthorizedLinks,
            links => links.ToJson());

        builder.HasMany(item => item.Categories)
            .WithMany(category => category.ContentItems)
            .UsingEntity(join => join.ToTable("content_item_categories"));

        // One record per (type, slug) — the frontend route space, so the API can 409 on a
        // collision before SQL ever rejects it. Slugs are normalised lower-case by the domain,
        // so a binary unique index cannot split one slug across two cases the way SQL Server's
        // CI collation silently did.
        builder.HasIndex(item => new { item.Type, item.Slug }).IsUnique();

        // Library pages filter by type then sort by date; this covers both the newest and
        // oldest orderings without a sort spill.
        builder.HasIndex(item => new { item.Type, item.PublishedAt });

        builder.HasIndex(item => item.PublishedAt);
        builder.HasIndex(item => item.Featured);
        builder.HasIndex(item => item.SeriesName);
    }
}
