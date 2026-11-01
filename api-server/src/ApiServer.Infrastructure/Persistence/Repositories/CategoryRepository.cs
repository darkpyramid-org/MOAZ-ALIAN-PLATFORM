using ApiServer.Application.Abstractions.Persistence;
using ApiServer.Application.Contracts.Categories;
using ApiServer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ApiServer.Infrastructure.Persistence.Repositories;

public sealed class CategoryRepository(ApplicationDbContext database) : ICategoryRepository
{
    public Task<Category?> FindByIdAsync(string id, CancellationToken cancellationToken) =>
        database.Categories.FirstOrDefaultAsync(category => category.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Category>> FindManyAsync(IReadOnlyList<string> ids, CancellationToken cancellationToken)
    {
        // Distinct first: an editor payload with the same id repeated must not turn into
        // duplicate link rows or a false "found" count in the use case.
        var distinctIds = ids.Distinct(StringComparer.Ordinal).ToArray();

        var found = await database.Categories
            .Where(category => distinctIds.Contains(category.Id))
            .ToListAsync(cancellationToken);

        return PreserveRequestOrder(distinctIds, found);
    }

    public async Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken) =>
        await database.Categories
            .AsNoTracking()
            .OrderBy(category => category.SortOrder)
            .ThenBy(category => category.Name)
            .Select(category => new CategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Description = category.Description,
                SortOrder = category.SortOrder,
                // Correlated COUNT on the link table: the dashboard gets accurate numbers
                // without the server materialising a single content row.
                ContentCount = category.ContentItems.Count,
                CreatedAt = category.CreatedAt,
                UpdatedAt = category.UpdatedAt,
            })
            .ToListAsync(cancellationToken);

    public Task<bool> HasContentAsync(string id, CancellationToken cancellationToken) =>
        database.ContentItems.AnyAsync(
            item => item.Categories.Any(category => category.Id == id),
            cancellationToken);

    public Task<bool> IdExistsAsync(string id, CancellationToken cancellationToken) =>
        database.Categories.AnyAsync(category => category.Id == id, cancellationToken);

    public void Add(Category category) => _ = database.Categories.Add(category);

    public void Remove(Category category) => _ = database.Categories.Remove(category);

    private static List<Category> PreserveRequestOrder(IReadOnlyList<string> ids, List<Category> found)
    {
        // Returning rows in request order keeps the link table stable across identical saves,
        // so an unchanged assignment produces no diff and no write.
        var byId = new Dictionary<string, Category>(StringComparer.Ordinal);

        foreach (var category in found)
        {
            _ = byId.TryAdd(category.Id, category);
        }

        List<Category> ordered = new(found.Count);

        foreach (var id in ids)
        {
            if (byId.TryGetValue(id, out var category))
            {
                ordered.Add(category);
            }
        }

        return ordered;
    }
}
