using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Content;
using ApiServer.Domain.Entities;
using ApiServer.Domain.Enums;

namespace ApiServer.Application.Abstractions.Persistence;

/// <summary>
/// Write side of the content aggregate: load, add, remove, and the uniqueness probes a
/// use case needs before it commits. Everything returns tracked entities.
/// </summary>
public interface IContentRepository
{
    Task<ContentItem?> FindByIdAsync(string id, CancellationToken cancellationToken);

    Task<bool> IdExistsAsync(string id, CancellationToken cancellationToken);

    /// <summary>Slug uniqueness is scoped per content type, exactly like the frontend routes.</summary>
    Task<bool> SlugExistsAsync(ContentType type, string slug, string? ignoreId, CancellationToken cancellationToken);

    void Add(ContentItem item);

    void Remove(ContentItem item);
}

/// <summary>
/// Read side of the public library. Queries project straight onto the response contracts
/// instead of materialising aggregates.
/// <para>
/// This is the deliberate performance decision in the architecture. Loading a page of 24
/// aggregates would drag the Markdown body, references and links for every row and still
/// leave EF building change-tracking snapshots the response throws away. Projection keeps
/// the SQL narrow and the read path allocation-light.
/// </para>
/// <para>
/// It is not "CQRS" as a framework: there is no mediator, no command object and no dispatcher.
/// Two interfaces and one DbContext, both defined by the use cases that need them.
/// </para>
/// </summary>
public interface IContentReader
{
    Task<PagedResult<ContentSummaryDto>> QueryAsync(ContentQuery query, CancellationToken cancellationToken);

    Task<ContentItemDto?> FindBySlugAsync(ContentType type, string slug, CancellationToken cancellationToken);

    /// <summary>Used to read a record back after a write, so the response reflects database state.</summary>
    Task<ContentItemDto?> FindByIdAsync(string id, CancellationToken cancellationToken);

    Task<IReadOnlyList<ContentSummaryDto>> FindFeaturedAsync(int take, CancellationToken cancellationToken);

    /// <summary>
    /// Every record with its full projection, newest first. Exists for the frontend's SSR
    /// hydration pool, which needs detail fields (body, links, isbn) on all items at once;
    /// bounded by the corpus size and cached like any other read.
    /// </summary>
    Task<IReadOnlyList<ContentItemDto>> SnapshotAsync(CancellationToken cancellationToken);

    /// <summary>Search-term-free totals for the library header; served from one COUNT query.</summary>
    Task<IReadOnlyList<ContentTypeCountDto>> CountByTypeAsync(CancellationToken cancellationToken);
}
