using ApiServer.Application.Contracts.Auth;

namespace ApiServer.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(string email, string password, CancellationToken cancellationToken = default);
    Task<AuthResponse> RegisterAsync(string email, string password, CancellationToken cancellationToken = default);
    Task<AuthUserDto?> GetCurrentUserAsync(CancellationToken cancellationToken = default);
}

