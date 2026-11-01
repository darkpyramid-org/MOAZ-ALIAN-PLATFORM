using System.Text.RegularExpressions;
using ApiServer.Domain.Common;
using ApiServer.Domain.Enums;
using ApiServer.Domain.ValueObjects;

namespace ApiServer.Domain.Entities;

/// <summary>
/// A single library record: video, book, article or research. Aggregate root.
/// <para>
/// One table with a discriminator rather than four tables: listings, search and the
/// featured rail all query across types, and the frontend already models content as one
/// union type. Type-specific columns stay NULL for unrelated types, which is enforced by
/// <see cref="Update"/> so stale data can never survive a type change.
/// </para>
/// </summary>
public sealed partial class ContentItem
{
    public const int IdMaxLength = 100;
    public const int TitleMaxLength = 300;
    public const int DescriptionMaxLength = 2000;

    /// <summary>Stored Markdown. Bounded to keep a single row off the LOB write path in normal use.</summary>
    public const int BodyMaxLength = 100_000;

    public const int TagsMaxLength = 40;
    public const int MaxTags = 60;
    public const int MaxReferences = 100;
    public const int MaxAuthorizedLinks = 20;
    public const int MaxDurationSeconds = 86_400;

    private const int ShortTextMaxLength = 200;
    private const int UrlMaxLength = 2048;

    [GeneratedRegex(@"^(?:[0-9]{9}[0-9Xx]|[0-9]{13})$", RegexOptions.CultureInvariant)]
    private static partial Regex IsbnPattern();

    // Collections are get-only and mutated exclusively through the methods below — the same
    // pattern the Microsoft reference architectures use. EF Core fills the existing instances
    // during materialisation, so no setter is needed and the domain keeps full control.
    public ICollection<Category> Categories { get; } = new List<Category>();

    public ICollection<string> Tags { get; } = new List<string>();

    public ICollection<string> References { get; } = new List<string>();

    public ICollection<AuthorizedLink> AuthorizedLinks { get; } = new List<AuthorizedLink>();

    /// <summary>EF Core materialisation entry point.</summary>
    private ContentItem()
    {
    }

    // ---------- identity & shared shape ----------

    public string Id { get; private set; } = default!;

    public ContentType Type { get; private set; }

    public string Slug { get; private set; } = default!;

    public string Title { get; private set; } = default!;

    public string Description { get; private set; } = string.Empty;

    public string? ThumbnailUrl { get; private set; }

    public string? AuthorName { get; private set; }

    public string? SourceUrl { get; private set; }

    public string? Body { get; private set; }

    public bool Featured { get; private set; }

    public bool Verified { get; private set; }

    public bool Demo { get; private set; }

    public RightsStatus RightsStatus { get; private set; }

    public DateTimeOffset? PublishedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    // ---------- video ----------

    public string? VideoId { get; private set; }

    public VideoProvider? VideoProvider { get; private set; }

    public int? DurationSeconds { get; private set; }

    public string? SeriesName { get; private set; }

    // ---------- book ----------

    public string? CoverUrl { get; private set; }

    public string? Publisher { get; private set; }

    public string? Isbn { get; private set; }

    public int? PublicationYear { get; private set; }

    public BookAvailability? Availability { get; private set; }

    // ---------- article ----------

    public int? ReadingTimeMinutes { get; private set; }

    // ---------- research ----------

    public string? DocumentUrl { get; private set; }

    public string? DocumentFormat { get; private set; }

    /// <summary>
    /// Resolves the URL identifier a draft will end up with. Exposed as a static so a use case
    /// can run the uniqueness probe before building the aggregate, with exactly the rule the
    /// aggregate itself will apply.
    /// </summary>
    public static string ResolveSlug(string? slug, string? title) =>
        Slugs.Required(string.IsNullOrWhiteSpace(slug) ? title : slug);

    /// <summary>Creates a new record from a draft and stamps its timestamps.</summary>
    public static ContentItem Create(string? id, ContentItemDraft draft, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(draft);

        var item = new ContentItem
        {
            Id = Guard.Optional(id, IdMaxLength, "Content id") ?? NewId(draft.Title),
        };

        item.Apply(draft);
        item.Touch(now);
        return item;
    }

    /// <summary>
    /// Replaces the whole editable state of the record. A full replacement keeps the write
    /// model honest: any field a caller forgets to send is cleared rather than silently kept.
    /// </summary>
    public void Update(ContentItemDraft draft, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(draft);

        Apply(draft);
        Touch(now);
    }

    /// <summary>
    /// Replaces the category assignment. Categories must already be loaded and validated by
    /// the caller, so this cannot point content at a category that does not exist.
    /// </summary>
    public void AssignCategories(IReadOnlyCollection<Category> categories)
    {
        ArgumentNullException.ThrowIfNull(categories);

        if (categories.Count == 0)
        {
            throw new DomainException("A library record must belong to at least one category.");
        }

        var assigned = new HashSet<string>(StringComparer.Ordinal);

        foreach (var category in categories)
        {
            ArgumentNullException.ThrowIfNull(category);

            // Compared by id, not by reference: EF may hand back two instances of one category.
            if (!assigned.Add(category.Id))
            {
                throw new DomainException($"Category '{category.Id}' was supplied more than once.");
            }
        }

        Categories.Clear();

        foreach (var category in categories)
        {
            Categories.Add(category);
        }
    }

    private void Apply(ContentItemDraft draft)
    {
        // Every assignment runs after full validation, so a rejected draft leaves no partial state.
        Validate(draft);

        Type = draft.Type;

        // An omitted slug is derived from the title rather than rejected: the frontend routes
        // on slug and editors routinely leave the field blank.
        Slug = ResolveSlug(draft.Slug, draft.Title);
        Title = Guard.Required(draft.Title, "Title", TitleMaxLength);
        Description = Guard.Optional(draft.Description, DescriptionMaxLength, "Description") ?? string.Empty;
        ThumbnailUrl = Guard.Url(draft.ThumbnailUrl, "Thumbnail url", UrlMaxLength);
        AuthorName = Guard.Optional(draft.AuthorName, ShortTextMaxLength, "Author name");
        SourceUrl = Guard.Url(draft.SourceUrl, "Source url", UrlMaxLength);
        Body = Guard.Optional(draft.Body, BodyMaxLength, "Body");
        Featured = draft.Featured;
        Verified = draft.Verified;
        Demo = draft.Demo;
        RightsStatus = Guard.Enum(draft.RightsStatus, nameof(draft.RightsStatus));
        PublishedAt = draft.PublishedAt?.ToUniversalTime();

        Replace(Tags, Guard.DistinctValues(draft.Tags ?? [], "Tag", TagsMaxLength), MaxTags);

        AssignTypeFields(draft);
    }

    /// <summary>
    /// Writes the type-specific block and clears every block that does not belong to the new
    /// type, so a video converted to a book cannot keep an orphan series name.
    /// </summary>
    private void AssignTypeFields(ContentItemDraft draft)
    {
        VideoId = null;
        VideoProvider = null;
        DurationSeconds = null;
        SeriesName = null;

        CoverUrl = null;
        Publisher = null;
        Isbn = null;
        PublicationYear = null;
        Availability = null;
        AuthorizedLinks.Clear();

        ReadingTimeMinutes = null;

        DocumentUrl = null;
        DocumentFormat = null;
        References.Clear();

        switch (draft.Type)
        {
            case ContentType.Video:
                VideoId = Guard.Optional(draft.VideoId, 64, "Video id");
                VideoProvider = draft.VideoProvider is { } provider
                    ? Guard.Enum(provider, nameof(draft.VideoProvider))
                    : null;
                DurationSeconds = draft.DurationSeconds;
                SeriesName = Guard.Optional(draft.SeriesName, ShortTextMaxLength, "Series name");
                break;

            case ContentType.Book:
                CoverUrl = Guard.Url(draft.CoverUrl, "Cover url", UrlMaxLength);
                Publisher = Guard.Optional(draft.Publisher, ShortTextMaxLength, "Publisher");
                Isbn = NormalizeIsbn(draft.Isbn);
                PublicationYear = draft.PublicationYear;
                Availability = draft.Availability is { } availability
                    ? Guard.Enum(availability, nameof(draft.Availability))
                    : null;

                var links = draft.AuthorizedLinks ?? [];
                if (links.Count > MaxAuthorizedLinks)
                {
                    throw new DomainException($"A book may list at most {MaxAuthorizedLinks} authorised links.");
                }

                foreach (var link in links)
                {
                    AuthorizedLinks.Add(AuthorizedLink.Create(link.Label, link.Url));
                }

                break;

            case ContentType.Article:
                ReadingTimeMinutes = draft.ReadingTimeMinutes;
                break;

            case ContentType.Research:
                DocumentUrl = Guard.Url(draft.DocumentUrl, "Document url", UrlMaxLength);
                DocumentFormat = Guard.Optional(draft.DocumentFormat, 20, "Document format");
                Replace(References, Guard.DistinctValues(draft.References ?? [], "Reference", 500), MaxReferences);
                break;
        }
    }

    private static void Validate(ContentItemDraft draft)
    {
        Guard.Range(draft.DurationSeconds, 0, MaxDurationSeconds, "Duration seconds");
        Guard.Range(draft.ReadingTimeMinutes, 0, 10_000, "Reading time minutes");
        Guard.Range(draft.PublicationYear, 800, 2100, "Publication year");

        if (draft.PublishedAt is { } published && published.Year < 800)
        {
            throw new DomainException("Published date looks implausible; use a full date (year 800 or later).");
        }

        // Metadata-only records are the platform's safe default, but they are useless without
        // somewhere to send the reader.
        if (draft.RightsStatus == RightsStatus.External && string.IsNullOrWhiteSpace(draft.SourceUrl))
        {
            throw new DomainException("Externally sourced records require a source URL so the reader can be sent to the publisher.");
        }

        switch (draft.Type)
        {
            case ContentType.Video:
                if (!string.IsNullOrWhiteSpace(draft.VideoId) && draft.VideoProvider is null)
                {
                    throw new DomainException("A video ID requires a video provider.");
                }

                break;

            case ContentType.Book:
                // ISBN shape is checked once, in NormaliseIsbn, while the field is assigned.
                break;

            case ContentType.Article:
                // Mirrors the frontend contract: a null body means an external article whose
                // detail page links out instead of reproducing the text.
                if (string.IsNullOrWhiteSpace(draft.Body) && string.IsNullOrWhiteSpace(draft.SourceUrl))
                {
                    throw new DomainException("An article with no stored text must carry a source URL to link out to.");
                }

                break;

            case ContentType.Research:
                if (string.IsNullOrWhiteSpace(draft.Body)
                    && string.IsNullOrWhiteSpace(draft.DocumentUrl)
                    && string.IsNullOrWhiteSpace(draft.SourceUrl))
                {
                    throw new DomainException("A research record needs stored text, a document URL, or a source URL.");
                }

                break;
        }
    }

    private static string? NormalizeIsbn(string? raw)
    {
        var candidate = Guard.Optional(raw, 32, "ISBN");
        if (candidate is null)
        {
            return null;
        }

        var compact = NormalizeIsbnChars(candidate);
        if (compact is null || !IsbnPattern().IsMatch(compact))
        {
            throw new DomainException("ISBN must be 10 or 13 digits (the final digit of a 10-digit ISBN may be X).");
        }

        return compact.ToUpperInvariant();
    }

    private static string? NormalizeIsbnChars(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        Span<char> buffer = stackalloc char[raw.Length];
        var length = 0;

        foreach (var character in raw)
        {
            if (char.IsWhiteSpace(character) || character == '-')
            {
                continue;
            }

            buffer[length++] = character;
        }

        return length == 0 ? null : new string(buffer[..length]);
    }

    /// <summary>
    /// Generates a readable id from the title, matching the frontend's text-id convention.
    /// The random suffix keeps two records created in the same second from colliding; the
    /// repository still enforces uniqueness before insert.
    /// </summary>
    private static string NewId(string? title)
    {
        var baseSlug = Slugs.Normalize(title);
        var suffix = Guid.NewGuid().ToString("N").AsSpan(0, 8);

        return baseSlug.Length == 0
            ? suffix.ToString()
            : string.Concat(baseSlug, "-", suffix);
    }

    private void Touch(DateTimeOffset now)
    {
        var utc = now.ToUniversalTime();

        if (CreatedAt == default)
        {
            CreatedAt = utc;
        }

        UpdatedAt = utc;
    }

    private static void Replace(ICollection<string> target, string[] values, int maximum)
    {
        if (values.Length > maximum)
        {
            throw new DomainException($"At most {maximum} values are allowed here (got {values.Length}).");
        }

        target.Clear();

        foreach (var value in values)
        {
            target.Add(value);
        }
    }
}
