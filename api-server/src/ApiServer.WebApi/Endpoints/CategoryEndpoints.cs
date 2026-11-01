using ApiServer.Application.Contracts.Categories;
using ApiServer.Application.Services;
using ApiServer.WebApi.Auth;
using FluentValidation;

namespace ApiServer.WebApi.Endpoints;

/// <summary>Category browsing for the public site and management for the dashboard.</summary>
public static class CategoryEndpoints
{
    public static RouteGroupBuilder MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/categories").WithTags("Categories");

        group.MapGet(
            "/",
            async (ICategoryService service, CancellationToken cancellationToken) =>
                Results.Ok(await service.ListAsync(cancellationToken)))
            .WithName("ListCategories")
            .WithSummary("All categories in display order, each with its live content count.");

        group.MapGet(
            "/{id}",
            async (string id, ICategoryService service, CancellationToken cancellationToken) =>
                Results.Ok(await service.GetAsync(id, cancellationToken)))
            .WithName("GetCategory")
            .WithSummary("One category by id.");

        // Writes follow the same gate as content: policy at the edge, service check underneath.

        group.MapPost(
            "/",
            async (
                UpsertCategoryRequest request,
                ICategoryService service,
                IValidator<UpsertCategoryRequest> validator,
                CancellationToken cancellationToken) =>
            {
                await validator.ValidateAndThrowAsync(request, cancellationToken);

                var created = await service.CreateAsync(request, cancellationToken);
                return Results.Created($"/api/categories/{created.Id}", created);
            })
            .RequireAuthorization(AuthorizationPolicies.ContentEditor)
            .RequireRateLimiting(RateLimitPolicies.Editorial)
            .WithName("CreateCategory")
            .WithSummary("Create a category. Requires an editor or admin token.");

        group.MapPut(
            "/{id}",
            async (
                string id,
                UpsertCategoryRequest request,
                ICategoryService service,
                IValidator<UpsertCategoryRequest> validator,
                CancellationToken cancellationToken) =>
            {
                await validator.ValidateAndThrowAsync(request, cancellationToken);

                var updated = await service.UpdateAsync(id, request, cancellationToken);
                return Results.Ok(updated);
            })
            .RequireAuthorization(AuthorizationPolicies.ContentEditor)
            .RequireRateLimiting(RateLimitPolicies.Editorial)
            .WithName("UpdateCategory")
            .WithSummary("Rename, re-description, or reorder a category. The id is immutable.");

        group.MapDelete(
            "/{id}",
            async (string id, ICategoryService service, CancellationToken cancellationToken) =>
            {
                // The service refuses (409) while content still points at the category,
                // so no request can silently orphan library rows.
                await service.DeleteAsync(id, cancellationToken);
                return Results.NoContent();
            })
            .RequireAuthorization(AuthorizationPolicies.ContentEditor)
            .RequireRateLimiting(RateLimitPolicies.Editorial)
            .WithName("DeleteCategory")
            .WithSummary("Delete a category. Fails with 409 while content references it.");

        return group;
    }
}
