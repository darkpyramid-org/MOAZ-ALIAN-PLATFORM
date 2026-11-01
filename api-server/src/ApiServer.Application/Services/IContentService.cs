using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Content;
using ApiServer.Domain.Enums;

namespace ApiServer.Application.Services;

/// <summary>Everything the frontend library and dashboard need from the content aggregate.</summary>
public interface IContentService
{
    Task<PagedResult<ContentSummaryDto>> ListAsync(ContentQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// Detail read addressed the way the frontend routes are: <c>/books/{slug}</c>.
    /// A blank or unusable slug is a 404, not a 400 — there is nothing to recover from.
    /// </summary>
    Task<ContentItemDto> GetAsync(ContentType type, string? slug, CancellationToken cancellationToken);

    Task<IReadOnlyList<ContentTypeCountDto>> GetCountsAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Full detail records for the whole corpus, newest first — the one read meant to hydrate
    /// an entire client-side pool (the frontend's SSR store). Cached; every write invalidates it.
    /// </summary>
    Task<IReadOnlyList<ContentItemDto>> GetSnapshotAsync(CancellationToken cancellationToken);

    Task<ContentItemDto> CreateAsync(UpsertContentItemRequest request, CancellationToken cancellationToken);

    Task<ContentItemDto> UpdateAsync(string id, UpsertContentItemRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(string id, CancellationToken cancellationToken);
}
