using ApiServer.Application.Abstractions.Persistence;
using ApiServer.Domain.Entities;
using ApiServer.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ApiServer.Infrastructure.Persistence.Repositories;

/// <summary>Tracked, aggregate-level access. Everything here returns real domain objects.</summary>
public sealed class ContentRepository(ApplicationDbContext database) : IContentRepository
{
    public Task<ContentItem?> FindByIdAsync(string id, CancellationToken cancellationToken) =>
        database.ContentItems
            .Include(item => item.Categories)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

    public Task<bool> IdExistsAsync(string id, CancellationToken cancellationToken) =>
        database.ContentItems.AnyAsync(item => item.Id == id, cancellationToken);

    public Task<bool> SlugExistsAsync(ContentType type, string slug, string? ignoreId, CancellationToken cancellationToken) =>
        database.ContentItems
            .Where(item => item.Type == type && item.Slug == slug)
            .Where(item => ignoreId == null || item.Id != ignoreId)
            .AnyAsync(cancellationToken);

    public void Add(ContentItem item) => _ = database.ContentItems.Add(item);

    public void Remove(ContentItem item) => _ = database.ContentItems.Remove(item);
}
