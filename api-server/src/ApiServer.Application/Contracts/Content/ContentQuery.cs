using ApiServer.Domain.Enums;

namespace ApiServer.Application.Contracts.Content;

/// <summary>Ordering options, named to match the frontend's <c>SortKey</c> values.</summary>
public enum ContentSort
{
    /// <summary>Newest first — the listing default.</summary>
    Newest = 0,

    /// <summary>Oldest first.</summary>
    Oldest = 1,

    /// <summary>Title, using ICU culture-aware comparison so Arabic ordering reads correctly.</summary>
    Title = 2,

    /// <summary>Best match first; only meaningful together with a search term.</summary>
    Relevance = 3,
}

/// <summary>
/// One bounded query for the public library, covering every combination the frontend listing
/// pages issue: type, category, series, free-text search, sort and page.
/// </summary>
public sealed record ContentQuery
{
    public const int DefaultPageSize = 24;
    public const int MaxPageSize = 100;
    public const int MaxSearchLength = 200;

    /// <summary>Null means "all four content types", matching the combined library view.</summary>
    public ContentType? Type { get; init; }

    public string? CategoryId { get; init; }

    public string? Search { get; init; }

    /// <summary>Video series filter; matches <c>SeriesName</c> case-insensitively.</summary>
    public string? Series { get; init; }

    public bool? Featured { get; init; }

    /// <summary>Demo rows are included by default because the UI labels rather than hides them.</summary>
    public bool? Demo { get; init; }

    public ContentSort Sort { get; init; } = ContentSort.Newest;

    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = DefaultPageSize;

    /// <summary>Normalised form used for cache keys, so equivalent queries share one entry.</summary>
    public ContentQuery Normalize() => this with
    {
        Page = Page < 1 ? 1 : Page,
        PageSize = PageSize switch
        {
            < 1 => DefaultPageSize,
            > MaxPageSize => MaxPageSize,
            _ => PageSize,
        },
        Search = string.IsNullOrWhiteSpace(Search) ? null : Search.Trim(),
        CategoryId = string.IsNullOrWhiteSpace(CategoryId) ? null : CategoryId.Trim(),
        Series = string.IsNullOrWhiteSpace(Series) ? null : Series.Trim(),
    };
}
