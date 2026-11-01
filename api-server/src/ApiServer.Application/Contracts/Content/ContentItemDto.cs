using ApiServer.Domain.Enums;

namespace ApiServer.Application.Contracts.Content;

/// <summary>
/// Full read model for a detail page. Field names and casing match the frontend's
/// <c>ContentItem</c> union in <c>src/types/content.ts</c>, so the browser can consume the
/// response without a translation layer.
/// </summary>
public sealed record ContentItemDto
{
    public required string Id { get; init; }

    public ContentType Type { get; init; }

    public required string Slug { get; init; }

    public required string Title { get; init; }

    public string Description { get; init; } = string.Empty;

    public string? ThumbnailUrl { get; init; }

    public string? AuthorName { get; init; }

    public string? SourceUrl { get; init; }

    /// <summary>Stored Markdown. Omitted from listing responses; see <see cref="ContentSummaryDto"/>.</summary>
    public string? Body { get; init; }

    public IReadOnlyList<string> CategoryIds { get; init; } = [];

    public IReadOnlyList<string> Tags { get; init; } = [];

    public bool Featured { get; init; }

    public bool Verified { get; init; }

    public bool Demo { get; init; }

    public RightsStatus RightsStatus { get; init; }

    public DateTimeOffset? PublishedAt { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }

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

    public IReadOnlyList<AuthorizedLinkDto> AuthorizedLinks { get; init; } = [];

    // ---- article ----
    public int? ReadingTimeMinutes { get; init; }

    // ---- research ----
    public IReadOnlyList<string> References { get; init; } = [];

    public string? DocumentUrl { get; init; }

    public string? DocumentFormat { get; init; }
}

/// <summary>An authorised reading link, as rendered on a book detail page.</summary>
public sealed record AuthorizedLinkDto(string Label, string Url);
