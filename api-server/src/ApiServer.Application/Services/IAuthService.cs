using ApiServer.Application.Contracts.Auth;

namespace ApiServer.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(string email, string password, CancellationToken cancellationToken = default);
    Task<AuthResponse> RegisterAsync(string email, string password, CancellationToken cancellationToken = default);
    Task<AuthUserDto?> GetCurrentUserAsync(CancellationToken cancellationToken = default);
    Task<AuthUserDto> UpdateProfileAsync(string? displayName, string? avatarUrl, CancellationToken cancellationToken = default);
    Task ChangePasswordAsync(string currentPassword, string newPassword, CancellationToken cancellationToken = default);
    Task<AuthResponse> ExternalLoginAsync(string email, string? displayName, string? avatarUrl, string provider, CancellationToken cancellationToken = default);
    Task<string?> ForgotPasswordAsync(string email, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default);
}

