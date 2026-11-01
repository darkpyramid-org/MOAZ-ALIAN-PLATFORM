namespace ApiServer.Application.Abstractions;

/// <summary>
/// The caller behind the current request, expressed without HTTP types.
/// Roles originate in the platform's <c>user_roles</c> table and reach the API through the
/// Supabase access token (app_metadata.roles); the adapter decides how to read them.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    /// <summary>Supabase user uid, or null for anonymous requests.</summary>
    string? UserId { get; }

    IReadOnlyCollection<string> Roles { get; }

    /// <summary>Editors and admins may write; only admins manage users and settings.</summary>
    bool CanEditContent { get; }

    bool IsAdmin { get; }
}
