using ApiServer.Application.Abstractions;
using ApiServer.Application.Abstractions.Persistence;
using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Categories;
using ApiServer.Application.Contracts.Content;
using ApiServer.Domain.Entities;
using ApiServer.Domain.Enums;

namespace ApiServer.Application.Tests.Fakes;

// ---------------------------------------------------------------------------
// Hand-written fakes instead of a mocking library: fewer dependencies, no
// reflection surprises, and every fake doubles as executable documentation
// of what its port is allowed to do.
// ---------------------------------------------------------------------------

public sealed class FixedClock(DateTimeOffset utcNow) : IClock
{
    public DateTimeOffset UtcNow { get; } = utcNow.ToUniversalTime();
}

public sealed class FakeCurrentUser : ICurrentUser
{
    public bool IsAuthenticated => true;

    public string? UserId => "test-user";

    public IReadOnlyCollection<string> Roles { get; init; } = ["editor"];

    public bool CanEditContent { get; init; } = true;

    public bool IsAdmin { get; init; }
}

/// <summary>Dictionary-backed cache; the counters let tests assert hit/miss behaviour.</summary>
public sealed class FakeReadThroughCache : IReadThroughCache
{
    private readonly Dictionary<string, object> _entries = new(StringComparer.Ordinal);

    public int GetCount { get; private set; }

    public int SetCount { get; private set; }

    public Task<T?> TryGetAsync<T>(string key, CancellationToken cancellationToken)
        where T : class
    {
        GetCount++;
        return Task.FromResult(_entries.TryGetValue(key, out var value) ? (T)value : null);
    }

    public Task SetAsync<T>(string key, T value, TimeSpan timeToLive, CancellationToken cancellationToken)
        where T : class
    {
        SetCount++;
        _entries[key] = value;
        return Task.CompletedTask;
    }
}

public sealed class FakeCacheVersion : IContentCacheVersion
{
    public long Current { get; private set; } = 1;

    public void Bump() => Current++;
}

public sealed class FakeUnitOfWork : IUnitOfWork
{
    public int SaveCount { get; private set; }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveCount++;
        return Task.FromResult(1);
    }
}

public sealed class FakeContentRepository : IContentRepository
{
    public List<ContentItem> Items { get; } = [];

    public Task<ContentItem?> FindByIdAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Items.FirstOrDefault(item => string.Equals(item.Id, id, StringComparison.Ordinal)));

    public Task<bool> IdExistsAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Items.Any(item => string.Equals(item.Id, id, StringComparison.Ordinal)));

    public Task<bool> SlugExistsAsync(ContentType type, string slug, string? ignoreId, CancellationToken cancellationToken) =>
        Task.FromResult(Items.Any(item =>
            item.Type == type
            && string.Equals(item.Slug, slug, StringComparison.Ordinal)
            && (ignoreId is null || !string.Equals(item.Id, ignoreId, StringComparison.Ordinal))));

    public void Add(ContentItem item) => Items.Add(item);

    public void Remove(ContentItem item) => Items.Remove(item);
}

/// <summary>
/// Reads from the same in-memory list the repository writes to, so the service's
/// read-back-after-save path works without any scripted expectations.
/// </summary>
public sealed class FakeContentReader(List<ContentItem> items) : IContentReader
{
    public int QueryCount { get; private set; }

    public int SnapshotCount { get; private set; }

    public Func<ContentQuery, PagedResult<ContentSummaryDto>>? OnQuery { get; set; }

    public Task<PagedResult<ContentSummaryDto>> QueryAsync(ContentQuery query, CancellationToken cancellationToken)
    {
        QueryCount++;
        return Task.FromResult(OnQuery?.Invoke(query) ?? new PagedResult<ContentSummaryDto>([], query.Page, query.PageSize, 0));
    }

    public Task<ContentItemDto?> FindBySlugAsync(ContentType type, string slug, CancellationToken cancellationToken)
    {
        var found = items.FirstOrDefault(item => item.Type == type && string.Equals(item.Slug, slug, StringComparison.Ordinal));
        return Task.FromResult(found is null ? null : ToDto(found));
    }

    public Task<ContentItemDto?> FindByIdAsync(string id, CancellationToken cancellationToken)
    {
        var found = items.FirstOrDefault(item => string.Equals(item.Id, id, StringComparison.Ordinal));
        return Task.FromResult(found is null ? null : ToDto(found));
    }

    public Task<IReadOnlyList<ContentSummaryDto>> FindFeaturedAsync(int take, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ContentSummaryDto>>([]);

    public Task<IReadOnlyList<ContentTypeCountDto>> CountByTypeAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ContentTypeCountDto>>(
            items.GroupBy(item => item.Type)
                .Select(group => new ContentTypeCountDto(group.Key, group.Count()))
                .ToArray());

    /// <summary>Mirrors the real reader's ordering so tests see the same sequence the API returns.</summary>
    public Task<IReadOnlyList<ContentItemDto>> SnapshotAsync(CancellationToken cancellationToken)
    {
        SnapshotCount++;
        return Task.FromResult<IReadOnlyList<ContentItemDto>>(
            items.OrderByDescending(item => item.PublishedAt ?? DateTimeOffset.MinValue)
                .ThenByDescending(static item => item.Id)
                .Select(ToDto)
                .ToArray());
    }

    public static ContentItemDto ToDto(ContentItem item) => new()
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
        CategoryIds = [.. item.Categories.Select(category => category.Id)],
        Tags = [.. item.Tags],
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
        AuthorizedLinks = [.. item.AuthorizedLinks.Select(link => new AuthorizedLinkDto(link.Label, link.Url))],
        ReadingTimeMinutes = item.ReadingTimeMinutes,
        References = [.. item.References],
        DocumentUrl = item.DocumentUrl,
        DocumentFormat = item.DocumentFormat,
    };
}

public sealed class FakeCategoryRepository : ICategoryRepository
{
    public List<Category> Store { get; } = [];

    /// <summary>Scripted answer for the delete guard.</summary>
    public bool HasContentResult { get; set; }

    public int ContentCount { get; set; }

    public Task<Category?> FindByIdAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Store.FirstOrDefault(category => string.Equals(category.Id, id, StringComparison.Ordinal)));

    public Task<IReadOnlyList<Category>> FindManyAsync(IReadOnlyList<string> ids, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Category>>(
            ids.Select(id => Store.FirstOrDefault(category => string.Equals(category.Id, id, StringComparison.Ordinal)))
                .OfType<Category>()
                .ToArray());

    public Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CategoryDto>>(
            Store.Select(category => new CategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Description = category.Description,
                SortOrder = category.SortOrder,
                ContentCount = ContentCount,
                CreatedAt = category.CreatedAt,
                UpdatedAt = category.UpdatedAt,
            }).ToArray());

    public Task<bool> HasContentAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(HasContentResult);

    public Task<bool> IdExistsAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Store.Any(category => string.Equals(category.Id, id, StringComparison.Ordinal)));

    public void Add(Category category) => Store.Add(category);

    public void Remove(Category category) => Store.Remove(category);
}
