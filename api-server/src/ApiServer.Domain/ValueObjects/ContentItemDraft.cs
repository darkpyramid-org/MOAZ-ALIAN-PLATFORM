using ApiServer.Domain.Enums;

namespace ApiServer.Domain.ValueObjects;

/// <summary>
/// Everything needed to create or fully replace a <see cref="Entities.ContentItem"/>.
/// <para>
/// A single write model rather than one factory per content type: the four shapes differ
/// only by which optional fields are meaningful, so separate factories would duplicate the
/// whole parameter list four times without adding safety. Type-specific rules live in
/// <see cref="Entities.ContentItem"/> where they can be enforced against the stored state.
/// </para>
/// </summary>
public sealed record ContentItemDraft
{
    public required ContentType Type { get; init; }

    public required string? Slug { get; init; }

    public required string? Title { get; init; }

    public string? Description { get; init; }

    public string? ThumbnailUrl { get; init; }

    public string? AuthorName { get; init; }

    public string? SourceUrl { get; init; }

    /// <summary>Stored Markdown detail text. Null for items whose text is not reproduced.</summary>
    public string? Body { get; init; }

    public IReadOnlyList<string>? Tags { get; init; }

    public bool Featured { get; init; }

    public bool Verified { get; init; }

    public bool Demo { get; init; }

    public RightsStatus RightsStatus { get; init; } = RightsStatus.Unknown;

    /// <summary>Normalised to UTC by the aggregate; a future date means scheduled content.</summary>
    public DateTimeOffset? PublishedAt { get; init; }

    // ---- video ----
    public string? VideoId { get; init; }

    public VideoProvider? VideoProvider { get; init; }

    public int? DurationSeconds { get; init; }

    public string? SeriesName { get; init; }

    // ---- book ----
    public string? CoverUrl { get; init; }

    public string? Publisher { get; init; }

    public string? Isbn { get; init; }

    public int? PublicationYear { get; init; }

    public BookAvailability? Availability { get; init; }

    public IReadOnlyList<AuthorizedLinkInput>? AuthorizedLinks { get; init; }

    // ---- article ----
    public int? ReadingTimeMinutes { get; init; }

    // ---- research ----
    public IReadOnlyList<string>? References { get; init; }

    public string? DocumentUrl { get; init; }

    public string? DocumentFormat { get; init; }
}

/// <summary>Raw link pair as supplied by a caller; validated when the aggregate consumes it.</summary>
public readonly record struct AuthorizedLinkInput(string? Label, string? Url);
