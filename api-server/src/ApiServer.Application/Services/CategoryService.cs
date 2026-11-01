using ApiServer.Application.Abstractions;
using ApiServer.Application.Abstractions.Persistence;
using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Categories;
using ApiServer.Domain.Entities;
using FluentValidation;
using Microsoft.Extensions.Options;

namespace ApiServer.Application.Services;

/// <summary>
/// Category use cases. Writes share the content cache token because a category rename or a
/// content edit both change what the category list shows (its content counts).
/// </summary>
public sealed class CategoryService(
    ICategoryRepository categories,
    IUnitOfWork unitOfWork,
    ICurrentUser currentUser,
    IClock clock,
    IReadThroughCache cache,
    IContentCacheVersion cacheVersion,
    IValidator<UpsertCategoryRequest> validator,
    IOptions<ContentCacheOptions> cacheOptions) : ICategoryService
{
    private readonly ContentCacheOptions _cacheOptions = cacheOptions.Value;

    public async Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken)
    {
        var key = FormattableString.Invariant($"categories:list:v{cacheVersion.Current}");

        if (_cacheOptions.Enabled && await cache.TryGetAsync<CategoryDto[]>(key, cancellationToken) is { } cached)
        {
            return cached;
        }

        var all = await categories.ListAsync(cancellationToken);

        // Snapshot, same reason as the content counts: the cached value is shared state.
        CategoryDto[] snapshot = [.. all];

        if (_cacheOptions.Enabled)
        {
            await cache.SetAsync(key, snapshot, _cacheOptions.CountsTtl, cancellationToken);
        }

        return snapshot;
    }

    public async Task<CategoryDto> GetAsync(string id, CancellationToken cancellationToken)
    {
        // Categories are a few dozen rows and the list is cached, so picking from it beats
        // giving the repository a second nearly identical projection.
        var all = await ListAsync(cancellationToken);
        return all.FirstOrDefault(category => string.Equals(category.Id, id, StringComparison.Ordinal))
            ?? throw new NotFoundException("Category", id);
    }

    public async Task<CategoryDto> CreateAsync(UpsertCategoryRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        RequireEditor();

        await validator.ValidateAndThrowAsync(request, cancellationToken);

        var id = request.Id.Trim();
        if (await categories.IdExistsAsync(id, cancellationToken))
        {
            throw new ConflictException($"Category '{id}' already exists.");
        }

        var category = Category.Create(id, request.Name, request.Description, request.SortOrder, clock.UtcNow);
        categories.Add(category);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        cacheVersion.Bump();

        return await GetAsync(category.Id, cancellationToken);
    }

    public async Task<CategoryDto> UpdateAsync(string id, UpsertCategoryRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        RequireEditor();

        await validator.ValidateAndThrowAsync(request, cancellationToken);

        var category = await categories.FindByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Category", id);

        // The id is how content records address their category; letting it change would
        // silently move published material between sections.
        if (!string.Equals(request.Id.Trim(), id, StringComparison.Ordinal))
        {
            throw new ConflictException("A category id cannot be changed. Create a new category and move the content.");
        }

        category.Update(request.Name, request.Description, request.SortOrder, clock.UtcNow);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        cacheVersion.Bump();

        return await GetAsync(id, cancellationToken);
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        RequireEditor();

        var category = await categories.FindByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Category", id);

        if (await categories.HasContentAsync(id, cancellationToken))
        {
            throw new ConflictException($"Category '{id}' still has content records. Move them first.");
        }

        categories.Remove(category);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        cacheVersion.Bump();
    }

    private void RequireEditor()
    {
        if (!currentUser.CanEditContent)
        {
            throw new ForbiddenException("Managing categories requires an admin or editor role.");
        }
    }
}
