using ApiServer.Domain.Enums;

namespace ApiServer.Application.Contracts.Content;

/// <summary>
/// The card-shaped read model used by listings and search.
/// <para>
/// Deliberately omits <c>Body</c>, <c>References</c> and <c>AuthorizedLinks</c>: a listing of
/// 24 records would otherwise ship hundreds of kilobytes of Markdown the cards never render.
/// The database query excludes those columns entirely rather than loading and discarding them.
/// </para>
/// </summary>
public sealed record ContentSummaryDto
{
    public required string Id { get; init; }

    public ContentType Type { get; init; }

    public required string Slug { get; init; }

    public required string Title { get; init; }

    public string Description { get; init; } = string.Empty;

    public string? ThumbnailUrl { get; init; }

    public string? CoverUrl { get; init; }

    public string? AuthorName { get; init; }

    public string? SourceUrl { get; init; }

    public IReadOnlyList<string> CategoryIds { get; init; } = [];

    public IReadOnlyList<string> Tags { get; init; } = [];

    public bool Featured { get; init; }

    public bool Verified { get; init; }

    public bool Demo { get; init; }

    public RightsStatus RightsStatus { get; init; }

    public DateTimeOffset? PublishedAt { get; init; }

    /// <summary>Drives the video series filter on the frontend.</summary>
    public string? SeriesName { get; init; }

    public int? DurationSeconds { get; init; }

    public int? ReadingTimeMinutes { get; init; }
}
