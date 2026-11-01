using ApiServer.Domain.Enums;

namespace ApiServer.Application.Contracts.Content;

/// <summary>
/// Write model shared by create and update.
/// <para>
/// Kept separate from the domain's <c>ContentItemDraft</c> on purpose: the JSON contract is a
/// published surface that the frontend depends on, while the draft is an internal model that
/// must stay free to evolve. One mapping function is the entire cost of that separation.
/// </para>
/// </summary>
public sealed record UpsertContentItemRequest
{
    public required ContentType Type { get; init; }

    /// <summary>When omitted, the server derives a slug from the title.</summary>
    public string? Slug { get; init; }

    public required string Title { get; init; }

    public string? Description { get; init; }

    public string? ThumbnailUrl { get; init; }

    public string? AuthorName { get; init; }

    public string? SourceUrl { get; init; }

    public string? Body { get; init; }

    public IReadOnlyList<string>? CategoryIds { get; init; }

    public IReadOnlyList<string>? Tags { get; init; }

    public bool Featured { get; init; }

    public bool Verified { get; init; }

    public bool Demo { get; init; }

    public RightsStatus RightsStatus { get; init; } = RightsStatus.Unknown;

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

    public IReadOnlyList<AuthorizedLinkInputDto>? AuthorizedLinks { get; init; }

    // ---- article ----
    public int? ReadingTimeMinutes { get; init; }

    // ---- research ----
    public IReadOnlyList<string>? References { get; init; }

    public string? DocumentUrl { get; init; }

    public string? DocumentFormat { get; init; }
}

/// <summary>Input side of <see cref="AuthorizedLinkDto"/>.</summary>
public sealed record AuthorizedLinkInputDto(string? Label, string? Url);
