using ApiServer.Application.Abstractions.Persistence;
using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Content;
using ApiServer.Domain.Entities;
using ApiServer.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ApiServer.Infrastructure.Persistence.Queries;

/// <summary>
/// SQL-side reads for the public library. Every method projects straight onto the response
/// contracts: no aggregates are materialised, no change tracker is filled, and listing queries
/// never SELECT the Markdown body.
/// </summary>
public sealed class ContentReader(ApplicationDbContext database) : IContentReader
{
    public async Task<PagedResult<ContentSummaryDto>> QueryAsync(ContentQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var filtered = Filter(query);
        var total = await filtered.CountAsync(cancellationToken);

        if (total == 0)
        {
            // A page beyond the end costs one COUNT instead of a COUNT, a wasted SELECT and
            // a materialisation pass.
            return new PagedResult<ContentSummaryDto>([], query.Page, query.PageSize, 0);
        }

        var rows = await Order(filtered, query)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(static item => new ContentSummaryDto
            {
                Id = item.Id,
                Type = item.Type,
                Slug = item.Slug,
                Title = item.Title,
                Description = item.Description,
                ThumbnailUrl = item.ThumbnailUrl,
                CoverUrl = item.CoverUrl,
                AuthorName = item.AuthorName,
                SourceUrl = item.SourceUrl,
                CategoryIds = item.Categories.Select(static category => category.Id).ToList(),
                Tags = item.Tags.ToList(),
                Featured = item.Featured,
                Verified = item.Verified,
                Demo = item.Demo,
                RightsStatus = item.RightsStatus,
                PublishedAt = item.PublishedAt,
                SeriesName = item.SeriesName,
                DurationSeconds = item.DurationSeconds,
                ReadingTimeMinutes = item.ReadingTimeMinutes,
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<ContentSummaryDto>(rows, query.Page, query.PageSize, total);
    }

    public async Task<ContentItemDto?> FindBySlugAsync(ContentType type, string slug, CancellationToken cancellationToken) =>
        await ProjectDetail(database.ContentItems.AsNoTracking().Where(item => item.Type == type && item.Slug == slug))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<ContentItemDto?> FindByIdAsync(string id, CancellationToken cancellationToken) =>
        await ProjectDetail(database.ContentItems.AsNoTracking().Where(item => item.Id == id))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<ContentSummaryDto>> FindFeaturedAsync(int take, CancellationToken cancellationToken) =>
        await database.ContentItems
            .AsNoTracking()
            .Where(item => item.Featured)
            .OrderByDescending(static item => item.PublishedAt ?? DateTimeOffset.MinValue)
            .ThenByDescending(static item => item.Id)
            .Take(take)
            .Select(static item => new ContentSummaryDto
            {
                Id = item.Id,
                Type = item.Type,
                Slug = item.Slug,
                Title = item.Title,
                Description = item.Description,
                ThumbnailUrl = item.ThumbnailUrl,
                CoverUrl = item.CoverUrl,
                AuthorName = item.AuthorName,
                SourceUrl = item.SourceUrl,
                CategoryIds = item.Categories.Select(static category => category.Id).ToList(),
                Tags = item.Tags.ToList(),
                Featured = item.Featured,
                Verified = item.Verified,
                Demo = item.Demo,
                RightsStatus = item.RightsStatus,
                PublishedAt = item.PublishedAt,
                SeriesName = item.SeriesName,
                DurationSeconds = item.DurationSeconds,
                ReadingTimeMinutes = item.ReadingTimeMinutes,
            })
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ContentItemDto>> SnapshotAsync(CancellationToken cancellationToken) =>
        await ProjectDetail(
            database.ContentItems
                .AsNoTracking()
                .OrderByDescending(static item => item.PublishedAt ?? DateTimeOffset.MinValue)
                .ThenByDescending(static item => item.Id))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ContentTypeCountDto>> CountByTypeAsync(CancellationToken cancellationToken) =>
        await database.ContentItems
            .AsNoTracking()
            .GroupBy(static item => item.Type)
            .Select(static group => new ContentTypeCountDto(group.Key, group.Count()))
            .ToListAsync(cancellationToken);

    private IQueryable<ContentItem> Filter(ContentQuery query)
    {
        IQueryable<ContentItem> filtered = database.ContentItems.AsNoTracking();

        if (query.Type is { } type)
        {
            filtered = filtered.Where(item => item.Type == type);
        }

        if (query.CategoryId is { Length: > 0 } categoryId)
        {
            filtered = filtered.Where(item => item.Categories.Any(category => category.Id == categoryId));
        }

        if (query.Series is { Length: > 0 } series)
        {
            // ILIKE with no wildcards is Postgres' case-insensitive equality, keeping the
            // frontend's "filter by series name, whatever the casing" behaviour.
            var needle = EscapeLikePattern(series);
            filtered = filtered.Where(item => EF.Functions.ILike(item.SeriesName!, needle));
        }

        if (query.Featured is { } featured)
        {
            filtered = filtered.Where(item => item.Featured == featured);
        }

        if (query.Demo is { } demo)
        {
            filtered = filtered.Where(item => item.Demo == demo);
        }

        if (query.Search is { Length: > 0 } search)
        {
            var pattern = string.Concat("%", EscapeLikePattern(search), "%");

            // ILIKE is case-insensitive by definition — SQL Server needed a CI collation for
            // this. For a corpus in the tens of thousands it beats a full-text setup (pg_trgm
            // GIN indexes / tsvector exist as the upgrade path; see README). Postgres' LIKE
            // index support is limited to prefix patterns, so mid-corpus growth is where FTS
            // starts paying for itself.
            filtered = filtered.Where(item =>
                EF.Functions.ILike(item.Title, pattern) ||
                EF.Functions.ILike(item.Description, pattern) ||
                EF.Functions.ILike(item.AuthorName!, pattern) ||
                EF.Functions.ILike(item.SeriesName!, pattern));
        }

        return filtered;
    }

    private static IOrderedQueryable<ContentItem> Order(IQueryable<ContentItem> source, ContentQuery query)
    {
        // Every ordering ends on Id so pagination is deterministic when dates tie.
        // The coalesce pins undated records to the far end instead of letting Postgres'
        // "NULLs sort last ascending / first descending" rules leak them to the top of a
        // newest-first page.
        return query.Sort switch
        {
            ContentSort.Oldest => source
                .OrderBy(item => item.PublishedAt ?? DateTimeOffset.MinValue)
                .ThenByDescending(static item => item.Id),

            ContentSort.Title => source
                .OrderBy(static item => item.Title)
                .ThenByDescending(static item => item.Id),

            ContentSort.Relevance when query.Search is { Length: > 0 } term => source
                .OrderBy(item => item.Title == term ? 0 : item.Title.StartsWith(term) ? 1 : 2)
                .ThenByDescending(item => item.PublishedAt ?? DateTimeOffset.MinValue)
                .ThenByDescending(static item => item.Id),

            _ => source
                .OrderByDescending(item => item.PublishedAt ?? DateTimeOffset.MinValue)
                .ThenByDescending(static item => item.Id),
        };
    }

    private static IQueryable<ContentItemDto> ProjectDetail(IQueryable<ContentItem> source) =>
        source.Select(static item => new ContentItemDto
        {
            Id = item.Id,
            Type = item.Type,
            Slug = item.Slug,
            Title = item.Title,
            Description = item.Description,
            ThumbnailUrl = item.ThumbnailUrl,
            AuthorName = item.AuthorName,
            SourceUrl = item.SourceUrl,
            Body = item.Body,
            CategoryIds = item.Categories.Select(static category => category.Id).ToList(),
            Tags = item.Tags.ToList(),
            Featured = item.Featured,
            Verified = item.Verified,
            Demo = item.Demo,
            RightsStatus = item.RightsStatus,
            PublishedAt = item.PublishedAt,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt,
            VideoId = item.VideoId,
            VideoProvider = item.VideoProvider,
            DurationSeconds = item.DurationSeconds,
            SeriesName = item.SeriesName,
            CoverUrl = item.CoverUrl,
            Publisher = item.Publisher,
            Isbn = item.Isbn,
            PublicationYear = item.PublicationYear,
            Availability = item.Availability,
            AuthorizedLinks = item.AuthorizedLinks
                .Select(static link => new AuthorizedLinkDto(link.Label, link.Url))
                .ToList(),
            ReadingTimeMinutes = item.ReadingTimeMinutes,
            References = item.References.ToList(),
            DocumentUrl = item.DocumentUrl,
            DocumentFormat = item.DocumentFormat,
        });

    /// <summary>
    /// Escapes the three LIKE/ILIKE wildcards with Postgres' default backslash escape
    /// character, so a search for "100%" or "a_b" matches those characters literally.
    /// The backslash itself must be escaped first.
    /// </summary>
    private static string EscapeLikePattern(string term) => term
        .Replace("\\", "\\\\", StringComparison.Ordinal)
        .Replace("%", "\\%", StringComparison.Ordinal)
        .Replace("_", "\\_", StringComparison.Ordinal);
}
