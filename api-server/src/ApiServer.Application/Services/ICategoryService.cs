using ApiServer.Application.Contracts.Categories;

namespace ApiServer.Application.Services;

/// <summary>Category browsing for the public site and management for the dashboard.</summary>
public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken);

    Task<CategoryDto> GetAsync(string id, CancellationToken cancellationToken);

    Task<CategoryDto> CreateAsync(UpsertCategoryRequest request, CancellationToken cancellationToken);

    Task<CategoryDto> UpdateAsync(string id, UpsertCategoryRequest request, CancellationToken cancellationToken);

    /// <summary>Refuses to orphan content that still points at the category.</summary>
    Task DeleteAsync(string id, CancellationToken cancellationToken);
}
