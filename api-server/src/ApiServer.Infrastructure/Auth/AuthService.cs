using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ApiServer.Application.Abstractions;
using ApiServer.Application.Contracts.Auth;
using ApiServer.Application.Services;
using ApiServer.Domain.Entities;
using ApiServer.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ApiServer.Infrastructure.Auth;

public sealed class AuthService(
    ApplicationDbContext dbContext,
    IOptions<AuthOptions> authOptions,
    IClock clock,
    ICurrentUser currentUser,
    ILogger<AuthService> logger) : IAuthService
{
    private readonly PasswordHasher<string> _passwordHasher = new();
    private readonly AuthOptions _options = authOptions.Value;

    public async Task<AuthResponse> LoginAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user is null)
        {
            // If no user exists at all in the database, seed this user as the first admin!
            var count = await dbContext.Users.CountAsync(cancellationToken);
            if (count == 0)
            {
                user = AppUser.Create(
                    Guid.NewGuid(),
                    normalizedEmail,
                    _passwordHasher.HashPassword(normalizedEmail, password),
                    [_options.AdminRole, _options.EditorRole],
                    clock.UtcNow);

                dbContext.Users.Add(user);
                await dbContext.SaveChangesAsync(cancellationToken);
                logger.LogInformation("Seeded initial admin user: {Email}", normalizedEmail);
            }
            else
            {
                throw new UnauthorizedAccessException("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
            }
        }
        else
        {
            var result = _passwordHasher.VerifyHashedPassword(user.Email, user.PasswordHash, password);
            if (result == PasswordVerificationResult.Failed)
            {
                throw new UnauthorizedAccessException("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
            }
        }

        var token = GenerateJwtToken(user);
        return new AuthResponse(token, MapToDto(user));
    }

    public async Task<AuthResponse> RegisterAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var exists = await dbContext.Users.AnyAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (exists)
        {
            throw new InvalidOperationException("هذا البريد الإلكتروني مسجل بالفعل.");
        }

        var count = await dbContext.Users.CountAsync(cancellationToken);
        var roles = count == 0
            ? new List<string> { _options.AdminRole, _options.EditorRole }
            : new List<string> { _options.EditorRole };

        var user = AppUser.Create(
            Guid.NewGuid(),
            normalizedEmail,
            _passwordHasher.HashPassword(normalizedEmail, password),
            roles,
            clock.UtcNow);

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        var token = GenerateJwtToken(user);
        return new AuthResponse(token, MapToDto(user));
    }

    public async Task<AuthUserDto?> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(currentUser.UserId))
        {
            return null;
        }

        if (Guid.TryParse(currentUser.UserId, out var guid))
        {
            var user = await dbContext.Users.FindAsync([guid], cancellationToken);
            if (user is not null)
            {
                return MapToDto(user);
            }
        }

        return new AuthUserDto(
            Guid.Empty,
            currentUser.UserId,
            currentUser.Roles.ToList(),
            currentUser.IsAdmin,
            currentUser.CanEditContent);
    }

    private string GenerateJwtToken(AppUser user)
    {
        var secret = _options.JwtSecret;
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("Auth:JwtSecret is not configured.");
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var issuer = _options.ResolveIssuer();
        var audience = _options.Audience;

        var rolesJson = JsonSerializer.Serialize(new { roles = user.Roles });

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("role", "authenticated"),
            new(_options.RolesMetadataClaimType, rolesJson),
        };

        foreach (var role in user.Roles)
        {
            claims.Add(new Claim("roles", role));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: clock.UtcNow.UtcDateTime.AddDays(7),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private AuthUserDto MapToDto(AppUser user)
    {
        var isAdmin = user.Roles.Contains(_options.AdminRole, StringComparer.OrdinalIgnoreCase);
        var canEdit = isAdmin || user.Roles.Contains(_options.EditorRole, StringComparer.OrdinalIgnoreCase);

        return new AuthUserDto(
            user.Id,
            user.Email,
            user.Roles,
            isAdmin,
            canEdit);
    }
}
