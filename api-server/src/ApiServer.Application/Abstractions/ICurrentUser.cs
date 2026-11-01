namespace ApiServer.Application.Abstractions;

/// <summary>
/// The caller behind the current request, expressed without HTTP types.
/// Roles originate in the platform's <c>library.users</c> table and are embedded in the
/// JWT claims; the adapter decides how to read them.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    /// <summary>Authenticated user id, or null for anonymous requests.</summary>
    string? UserId { get; }

    IReadOnlyCollection<string> Roles { get; }

    /// <summary>Editors and admins may write; only admins manage users and settings.</summary>
    bool CanEditContent { get; }

    bool IsAdmin { get; }
}
