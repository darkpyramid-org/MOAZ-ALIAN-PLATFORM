using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Content;
using ApiServer.Application.Services;
using ApiServer.Domain.Enums;
using ApiServer.WebApi.Auth;
using FluentValidation;

namespace ApiServer.WebApi.Endpoints;

/// <summary>
/// The public library plus the dashboard's content management. Kept as one coherent group:
/// everything here hangs off <c>/api/content</c> and speaks the Application layer's contracts
/// directly — no controller, no duplicated DTO layer, the record IS the API shape.
/// </summary>
public static class ContentEndpoints
{
    public static RouteGroupBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/content").WithTags("Content");

        group.MapGet(
            "/",
            async (
                [AsParameters] ContentQueryRequest request,
                IContentService service,
                IValidator<ContentQuery> validator,
                CancellationToken cancellationToken) =>
            {
                var query = request.ToQuery();
                await validator.ValidateAndThrowAsync(query, cancellationToken);

                // Out-of-range paging values are clamped, not rejected: a UI requesting
                // page 0 or size 500 should degrade, not error.
                var result = await service.ListAsync(query.Normalize(), cancellationToken);
                return Results.Ok(result);
            })
            .WithName("ListContent")
            .WithSummary("Paged library listing: filter by type, category, series, featured, demo, or search.")
            // Cache shape is stable and public; let intermediaries absorb the front page.
            .Produces<PagedResult<ContentSummaryDto>>();

        group.MapGet(
            "/counts",
            async (IContentService service, CancellationToken cancellationToken) =>
                Results.Ok(await service.GetCountsAsync(cancellationToken)))
            .WithName("ContentTypeCounts")
            .WithSummary("Per-type totals for the library tabs, without fetching any rows.");

        group.MapGet(
            "/snapshot",
            async (IContentService service, CancellationToken cancellationToken) =>
                Results.Ok(await service.GetSnapshotAsync(cancellationToken)))
            .WithName("GetContentSnapshot")
            .WithSummary(
                "Full detail records for the whole corpus, newest first. Built for the frontend's "
                + "SSR hydration pool; paged listing is the correct endpoint everywhere else.");

        group.MapGet(
            "/{type}/{slug}",
            async (
                string type,
                string slug,
                IContentService service,
                CancellationToken cancellationToken) =>
            {
                // Browsing routes address content the way the frontend does: /books/{slug}.
                // An unrecognised type segment is simply not a resource that exists.
                var contentType = ParseType(type)
                    ?? throw new NotFoundException("Content type", type);

                var item = await service.GetAsync(contentType, slug, cancellationToken);
                return Results.Ok(item);
            })
            .WithName("GetContentBySlug")
            .WithSummary("Full detail record by type and slug, addressed like the frontend routes.");

        // ---- writes: editors only, and throttled harder than reads ----
        // The use cases re-check the role themselves, so a policy mistake can never open a write.

        group.MapPost(
            "/",
            async (
                UpsertContentItemRequest request,
                IContentService service,
                IValidator<UpsertContentItemRequest> validator,
                CancellationToken cancellationToken) =>
            {
                await validator.ValidateAndThrowAsync(request, cancellationToken);

                var created = await service.CreateAsync(request, cancellationToken);

                // Headers must be ASCII and Arabic slugs are not; the Location value needs the
                // same percent-encoding a browser would put in the path.
                return Results.Created(
                    $"/api/content/{TypeSegment(created.Type)}/{Uri.EscapeDataString(created.Slug)}",
                    created);
            })
            .RequireAuthorization(AuthorizationPolicies.ContentEditor)
            .RequireRateLimiting(RateLimitPolicies.Editorial)
            .WithName("CreateContent")
            .WithSummary("Create a content item. Requires an editor or admin token.");

        group.MapPut(
            "/{id}",
            async (
                string id,
                UpsertContentItemRequest request,
                IContentService service,
                IValidator<UpsertContentItemRequest> validator,
                CancellationToken cancellationToken) =>
            {
                await validator.ValidateAndThrowAsync(request, cancellationToken);

                // Full replacement semantics: matches the dashboard's edit form, which always
                // sends the complete record, so nulling an optional field is expressible.
                var updated = await service.UpdateAsync(id, request, cancellationToken);
                return Results.Ok(updated);
            })
            .RequireAuthorization(AuthorizationPolicies.ContentEditor)
            .RequireRateLimiting(RateLimitPolicies.Editorial)
            .WithName("UpdateContent")
            .WithSummary("Replace a content record. Requires an editor or admin token.");

        group.MapDelete(
            "/{id}",
            async (string id, IContentService service, CancellationToken cancellationToken) =>
            {
                await service.DeleteAsync(id, cancellationToken);
                return Results.NoContent();
            })
            .RequireAuthorization(AuthorizationPolicies.ContentEditor)
            .RequireRateLimiting(RateLimitPolicies.Editorial)
            .WithName("DeleteContent")
            .WithSummary("Delete a content record. Requires an editor or admin token.");

        return group;
    }

    /// <summary>
    /// Accepts the API's own serialised enum names plus the plural segments the frontend's
    /// routes use (<c>/videos</c>, <c>/books</c>), so nobody has to remember which is which.
    /// </summary>
    private static ContentType? ParseType(string value) => value.ToLowerInvariant() switch
    {
        "video" or "videos" => ContentType.Video,
        "book" or "books" => ContentType.Book,
        "article" or "articles" => ContentType.Article,
        "research" => ContentType.Research,
        _ => null,
    };

    private static string TypeSegment(ContentType type) => type.ToString().ToLowerInvariant();
}
