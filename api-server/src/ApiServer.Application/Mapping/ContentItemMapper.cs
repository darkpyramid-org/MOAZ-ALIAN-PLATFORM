using ApiServer.Application.Contracts.Content;
using ApiServer.Domain.ValueObjects;

namespace ApiServer.Application.Mapping;

/// <summary>
/// Translates the HTTP write model into the domain draft.
/// Hand-written rather than a convention-based mapper: the two models differ on purpose, and
/// an explicit list of assignments is the only way a renamed or added field fails loudly
/// instead of mapping silently to null.
/// </summary>
public static class ContentItemMapper
{
    public static ContentItemDraft ToDraft(this UpsertContentItemRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        return new ContentItemDraft
        {
            Type = request.Type,
            Slug = request.Slug,
            Title = request.Title,
            Description = request.Description,
            ThumbnailUrl = request.ThumbnailUrl,
            AuthorName = request.AuthorName,
            SourceUrl = request.SourceUrl,
            Body = request.Body,
            Tags = request.Tags,
            Featured = request.Featured,
            Verified = request.Verified,
            Demo = request.Demo,
            RightsStatus = request.RightsStatus,
            PublishedAt = request.PublishedAt,
            VideoId = request.VideoId,
            VideoProvider = request.VideoProvider,
            DurationSeconds = request.DurationSeconds,
            SeriesName = request.SeriesName,
            CoverUrl = request.CoverUrl,
            Publisher = request.Publisher,
            Isbn = request.Isbn,
            PublicationYear = request.PublicationYear,
            Availability = request.Availability,
            AuthorizedLinks = request.AuthorizedLinks is null
                ? null
                : [.. request.AuthorizedLinks.Select(link => new AuthorizedLinkInput(link.Label, link.Url))],
            ReadingTimeMinutes = request.ReadingTimeMinutes,
            References = request.References,
            DocumentUrl = request.DocumentUrl,
            DocumentFormat = request.DocumentFormat,
        };
    }

    /// <summary>
    /// Cache key for a normalised query. Stable ordering of the optional parts means two
    /// equivalent requests always hit the same entry, and the invariant formatting keeps the
    /// key identical on every machine regardless of server culture.
    /// </summary>
    public static string BuildQueryKey(this ContentQuery query, long cacheVersion)
    {
        // Single interpolated string handed to Invariant(): keys must be byte-identical on every
        // machine, and splitting the expression would silently fall back to the server culture.
        int typeCode = (int?)query.Type ?? 0;
        int featuredFlag = query.Featured is true ? 1 : 0;
        int demoFlag = query.Demo is true ? 1 : 0;
        int sortCode = (int)query.Sort;

        return FormattableString.Invariant($"content:q:v{cacheVersion}|t={typeCode}|c={query.CategoryId}|s={query.Series}|f={featuredFlag}|d={demoFlag}|o={sortCode}|p={query.Page}|z={query.PageSize}|q={query.Search}");
    }
}
