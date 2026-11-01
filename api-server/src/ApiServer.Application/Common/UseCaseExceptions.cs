namespace ApiServer.Application.Common;

/// <summary>
/// Use-case failure signals. They carry no HTTP vocabulary — the WebApi layer alone decides
/// which status code each one becomes, so the Application layer stays transport-agnostic.
/// </summary>
public abstract class UseCaseException(string message) : Exception(message);

/// <summary>The addressed record does not exist (or is not visible to this caller).</summary>
public sealed class NotFoundException(string resourceName, string key)
    : UseCaseException($"{resourceName} '{key}' was not found.")
{
    public string ResourceName { get; } = resourceName;

    public string Key { get; } = key;
}

/// <summary>
/// The write is well formed but collides with an existing uniqueness constraint
/// (duplicate slug, duplicate id). Surfaces as 409 so a client can retry with a new value.
/// </summary>
public sealed class ConflictException(string message) : UseCaseException(message);

/// <summary>The caller is authenticated but lacks the role this operation requires.</summary>
public sealed class ForbiddenException(string message) : UseCaseException(message);
