using ApiServer.Application.Abstractions;
using ApiServer.Application.Abstractions.Persistence;
using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Content;
using ApiServer.Application.Mapping;
using ApiServer.Domain.Common;
using ApiServer.Domain.Entities;
using ApiServer.Domain.Enums;
using FluentValidation;
using Microsoft.Extensions.Options;

namespace ApiServer.Application.Services;

/// <summary>
/// Content use cases. This is the only place a request is turned into domain behaviour:
/// rights, uniqueness probes, category resolution, cache policy and the commit all live here,
/// so the HTTP layer stays a thin adapter and the domain stays free of orchestration.
/// </summary>
public sealed class ContentService(
    IContentRepository contents,
    IContentReader reader,
    ICategoryRepository categories,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    IClock clock,
    IReadThroughCache cache,
    IContentCacheVersion cacheVersion,
    IValidator<UpsertContentItemRequest> validator,
    IOptions<ContentCacheOptions> cacheOptions) : IContentService
{
    private readonly ContentCacheOptions _cacheOptions = cacheOptions.Value;

    public async Task<PagedResult<ContentSummaryDto>> ListAsync(ContentQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        // Clamping instead of rejecting: the frontend sends whatever is in the URL, and an
        // oversized page should shrink rather than fail.
        var normalized = query.Normalize();
        var key = normalized.BuildQueryKey(cacheVersion.Current);

        var cached = await GetFromCacheAsync<PagedResult<ContentSummaryDto>>(key, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var page = await reader.QueryAsync(normalized, cancellationToken);
        await SetCacheAsync(key, page, _cacheOptions.QueryTtl, cancellationToken);
        return page;
    }

    public async Task<ContentItemDto> GetAsync(ContentType type, string? slug, CancellationToken cancellationToken)
    {
        // Route slugs arrive verbatim; normalising means "/books/عقيدة" matches the stored form.
        var normalizedSlug = Slugs.Normalize(slug);
        if (normalizedSlug.Length == 0)
        {
            throw new NotFoundException("Content", slug ?? string.Empty);
        }

        GuardSupportedType(type);

        var key = FormattableString.Invariant($"content:slug:v{cacheVersion.Current}|{(int)type}|{normalizedSlug}");
        var cached = await GetFromCacheAsync<ContentItemDto>(key, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var found = await reader.FindBySlugAsync(type, normalizedSlug, cancellationToken);
        if (found is null)
        {
            throw new NotFoundException("Content", normalizedSlug);
        }

        await SetCacheAsync(key, found, _cacheOptions.ItemTtl, cancellationToken);
        return found;
    }

    public async Task<IReadOnlyList<ContentTypeCountDto>> GetCountsAsync(CancellationToken cancellationToken)
    {
        var key = FormattableString.Invariant($"content:counts:v{cacheVersion.Current}");
        var cached = await GetFromCacheAsync<ContentTypeCountDto[]>(key, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var counts = await reader.CountByTypeAsync(cancellationToken);

        // Snapshotted as an array: the cached value is shared by concurrent requests, so it
        // must not be something a caller can append to.
        ContentTypeCountDto[] snapshot = [.. counts];
        await SetCacheAsync(key, snapshot, _cacheOptions.CountsTtl, cancellationToken);
        return snapshot;
    }

    public async Task<IReadOnlyList<ContentItemDto>> GetSnapshotAsync(CancellationToken cancellationToken)
    {
        var key = FormattableString.Invariant($"content:snapshot:v{cacheVersion.Current}");
        var cached = await GetFromCacheAsync<ContentItemDto[]>(key, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var rows = await reader.SnapshotAsync(cancellationToken);

        // Same array-snapshot rule as counts: shared cached values must be immutable in practice.
        ContentItemDto[] snapshot = [.. rows];
        await SetCacheAsync(key, snapshot, _cacheOptions.QueryTtl, cancellationToken);
        return snapshot;
    }

    public async Task<ContentItemDto> CreateAsync(UpsertContentItemRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        RequireEditor();

        await validator.ValidateAndThrowAsync(request, cancellationToken);
        GuardSupportedType(request.Type);

        var draft = request.ToDraft();
        var slug = ContentItem.ResolveSlug(draft.Slug, draft.Title);

        if (await contents.SlugExistsAsync(draft.Type, slug, ignoreId: null, cancellationToken))
        {
            throw new ConflictException($"A {draft.Type} record with slug '{slug}' already exists.");
        }

        // The id is server-generated: clients address records by slug, and accepting a caller's
        // id would make every write a potential impersonation of another record.
        var item = ContentItem.Create(id: null, draft, clock.UtcNow);
        await ApplyCategoriesAsync(item, request.CategoryIds!, cancellationToken);

        contents.Add(item);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        InvalidateCache();

        return await ReadBackAsync(item.Id, cancellationToken);
    }

    public async Task<ContentItemDto> UpdateAsync(string id, UpsertContentItemRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        RequireEditor();

        await validator.ValidateAndThrowAsync(request, cancellationToken);
        GuardSupportedType(request.Type);

        var item = await contents.FindByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Content", id);

        var draft = request.ToDraft();
        var slug = ContentItem.ResolveSlug(draft.Slug, draft.Title);

        if (await contents.SlugExistsAsync(draft.Type, slug, ignoreId: item.Id, cancellationToken))
        {
            throw new ConflictException($"A {draft.Type} record with slug '{slug}' already exists.");
        }

        // Update validates the whole draft before assigning anything, so a rejected change
        // leaves the tracked entity untouched and the next Save becomes a no-op.
        item.Update(draft, clock.UtcNow);
        await ApplyCategoriesAsync(item, request.CategoryIds!, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        InvalidateCache();

        return await ReadBackAsync(item.Id, cancellationToken);
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        RequireEditor();

        var item = await contents.FindByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Content", id);

        contents.Remove(item);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        InvalidateCache();
    }

    /// <summary>
    /// Resolves the requested category ids against the database and rewires the link table.
    /// Missing ids fail the whole write: silent dropping would leave an editor believing the
    /// content was filed somewhere it never was.
    /// </summary>
    private async Task ApplyCategoriesAsync(ContentItem item, IReadOnlyList<string> requestedIds, CancellationToken cancellationToken)
    {
        var ids = requestedIds
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var found = await categories.FindManyAsync(ids, cancellationToken);

        if (found.Count != ids.Length)
        {
            var missing = ids.Except(found.Select(static category => category.Id), StringComparer.Ordinal);
            throw new NotFoundException("Category", string.Join(", ", missing));
        }

        item.AssignCategories(found);
    }

    private async Task<ContentItemDto> ReadBackAsync(string id, CancellationToken cancellationToken)
    {
        var dto = await reader.FindByIdAsync(id, cancellationToken);
        return dto ?? throw new NotFoundException("Content", id);
    }

    private void RequireEditor()
    {
        if (!currentUser.CanEditContent)
        {
            throw new ForbiddenException("Editing the library requires an admin or editor role.");
        }
    }

    private static void GuardSupportedType(ContentType type)
    {
        if (!Enum.IsDefined(type))
        {
            throw new DomainException($"Unsupported content type '{type}'.");
        }
    }

    private void InvalidateCache() => cacheVersion.Bump();

    private async Task<T?> GetFromCacheAsync<T>(string key, CancellationToken cancellationToken)
        where T : class => _cacheOptions.Enabled ? await cache.TryGetAsync<T>(key, cancellationToken) : null;

    private async Task SetCacheAsync<T>(string key, T value, TimeSpan ttl, CancellationToken cancellationToken)
        where T : class
    {
        if (_cacheOptions.Enabled)
        {
            await cache.SetAsync(key, value, ttl, cancellationToken);
        }
    }
}
