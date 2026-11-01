using ApiServer.Application.Abstractions;
using Microsoft.AspNetCore.Authorization;

namespace ApiServer.WebApi.Auth;

/// <summary>
/// Authorization policies, named once so endpoints and tests share the same vocabulary.
/// </summary>
public static class AuthorizationPolicies
{
    public const string ContentEditor = "ContentEditor";
    public const string SiteAdmin = "SiteAdmin";
}

/// <summary>
/// Marker requirements. The checks delegate to <see cref="ICurrentUser"/> instead of
/// <c>RequireRole</c> because roles can arrive both as individual <c>roles</c> claims and
/// inside the JSON <c>app_metadata</c> claim; only the Application port knows how to read
/// them, and this keeps the role-matching logic in exactly one place.
/// </summary>
public sealed class ContentEditorRequirement : IAuthorizationRequirement;

public sealed class SiteAdminRequirement : IAuthorizationRequirement;

/// <summary>
/// Handlers are registered as scoped services: <c>ICurrentUser</c> is request-scoped, and
/// <c>AuthorizationService</c> is itself scoped, so the lifetimes line up without captives.
/// A failed check yields a silent 401/403 from the middleware — the use cases additionally
/// call <c>RequireEditor()</c>, so even a misconfigured policy cannot let a write through.
/// </summary>
public sealed class ContentEditorRequirementHandler(ICurrentUser currentUser)
    : AuthorizationHandler<ContentEditorRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ContentEditorRequirement requirement)
    {
        if (currentUser.CanEditContent)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

public sealed class SiteAdminRequirementHandler(ICurrentUser currentUser)
    : AuthorizationHandler<SiteAdminRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        SiteAdminRequirement requirement)
    {
        if (currentUser.IsAdmin)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
