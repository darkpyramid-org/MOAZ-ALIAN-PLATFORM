using ApiServer.Application.Contracts.Categories;
using ApiServer.Domain.Entities;

namespace ApiServer.Application.Abstractions.Persistence;

/// <summary>Categories are a small, hot, read-mostly set: one query serves the whole list.</summary>
public interface ICategoryRepository
{
    Task<Category?> FindByIdAsync(string id, CancellationToken cancellationToken);

    /// <summary>
    /// Tracked load of the categories behind a content assignment. The result is keyed lookup
    /// material, so a use case can prove every requested id exists before touching the aggregate.
    /// </summary>
    Task<IReadOnlyList<Category>> FindManyAsync(IReadOnlyList<string> ids, CancellationToken cancellationToken);

    /// <summary>All categories in display order, with a content count computed in SQL.</summary>
    Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken);

    /// <summary>True when at least one record still points at the category.</summary>
    Task<bool> HasContentAsync(string id, CancellationToken cancellationToken);

    Task<bool> IdExistsAsync(string id, CancellationToken cancellationToken);

    void Add(Category category);

    void Remove(Category category);
}
