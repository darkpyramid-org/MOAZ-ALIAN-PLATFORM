namespace ApiServer.Application.Contracts.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record RegisterRequest(string Email, string Password);

public sealed record AuthUserDto(
    Guid Id,
    string Email,
    IReadOnlyList<string> Roles,
    bool IsAdmin,
    bool CanEditContent,
    string? DisplayName = null,
    string? AvatarUrl = null);

public sealed record UpdateProfileRequest(
    string? DisplayName = null,
    string? AvatarUrl = null);

public sealed record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

public sealed record AuthResponse(
    string Token,
    AuthUserDto User);

