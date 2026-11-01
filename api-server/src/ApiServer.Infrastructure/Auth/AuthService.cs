using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ApiServer.Application.Abstractions;
using ApiServer.Application.Contracts.Auth;
using ApiServer.Application.Services;
using System.Security.Cryptography;
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
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            throw new UnauthorizedAccessException("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user is null)
        {
            throw new UnauthorizedAccessException("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }

        var result = _passwordHasher.VerifyHashedPassword(user.Email, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed)
        {
            throw new UnauthorizedAccessException("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.UpdatePassword(_passwordHasher.HashPassword(user.Email, password));
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var token = GenerateJwtToken(user);
        return new AuthResponse(token, MapToDto(user));
    }

    public async Task<AuthResponse> RegisterAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            throw new ArgumentException("البريد الإلكتروني غير صالح.");
        }
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            throw new ArgumentException("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var exists = await dbContext.Users.AnyAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (exists)
        {
            throw new InvalidOperationException("هذا البريد الإلكتروني مسجل بالفعل.");
        }

        var count = await dbContext.Users.CountAsync(cancellationToken);
        var isAdminEmail = _options.AdminEmails.Contains(normalizedEmail, StringComparer.OrdinalIgnoreCase);
        var roles = (count == 0 || isAdminEmail)
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

    public async Task<AuthUserDto> UpdateProfileAsync(string? displayName, string? avatarUrl, CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(currentUser.UserId)
            || !Guid.TryParse(currentUser.UserId, out var guid))
        {
            throw new UnauthorizedAccessException("غير مصرح.");
        }

        var user = await dbContext.Users.FindAsync([guid], cancellationToken)
            ?? throw new UnauthorizedAccessException("المستخدم غير موجود.");

        user.UpdateProfile(displayName, avatarUrl);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(user);
    }

    public async Task ChangePasswordAsync(string currentPassword, string newPassword, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(currentPassword) || string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
        {
            throw new ArgumentException("كلمة المرور غير صالحة.");
        }

        if (!currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(currentUser.UserId)
            || !Guid.TryParse(currentUser.UserId, out var guid))
        {
            throw new UnauthorizedAccessException("غير مصرح.");
        }

        var user = await dbContext.Users.FindAsync([guid], cancellationToken)
            ?? throw new UnauthorizedAccessException("المستخدم غير موجود.");

        var result = _passwordHasher.VerifyHashedPassword(user.Email, user.PasswordHash, currentPassword);
        if (result == PasswordVerificationResult.Failed)
        {
            throw new UnauthorizedAccessException("كلمة المرور الحالية غير صحيحة.");
        }

        user.UpdatePassword(_passwordHasher.HashPassword(user.Email, newPassword));
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<AuthResponse> ExternalLoginAsync(string email, string? displayName, string? avatarUrl, string provider, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            throw new ArgumentException("البريد الإلكتروني غير صالح.");
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user is null)
        {
            var isAdminEmail = _options.AdminEmails.Contains(normalizedEmail, StringComparer.OrdinalIgnoreCase);
            var roles = isAdminEmail
                ? new List<string> { _options.AdminRole, _options.EditorRole }
                : new List<string> { _options.EditorRole };

            user = AppUser.Create(
                Guid.NewGuid(),
                normalizedEmail,
                _passwordHasher.HashPassword(normalizedEmail, Guid.NewGuid().ToString("N")),
                roles,
                clock.UtcNow);
            user.UpdateProfile(displayName, avatarUrl);
            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Created OAuth user via {Provider}: {Email}", provider, normalizedEmail);
        }
        else
        {
            // Link profile fields if missing.
            user.UpdateProfile(
                string.IsNullOrWhiteSpace(user.DisplayName) ? displayName : null,
                string.IsNullOrWhiteSpace(user.AvatarUrl) ? avatarUrl : null);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var token = GenerateJwtToken(user);
        return new AuthResponse(token, MapToDto(user));
    }
    public async Task<string?> ForgotPasswordAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (user is null) return null;

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');
        user.SetPasswordResetToken(token, clock.UtcNow.AddHours(1));
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Password reset token issued for {Email}: {Token}", normalizedEmail, token);
        return token;
    }

    public async Task ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
        {
            throw new ArgumentException("البيانات غير صالحة.");
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == token, cancellationToken)
            ?? throw new InvalidOperationException("رمز إعادة التعيين غير صالح.");

        if (user.PasswordResetExpiresAt is null || user.PasswordResetExpiresAt < clock.UtcNow)
        {
            throw new InvalidOperationException("رمز إعادة التعيين منتهي الصلاحية.");
        }

        user.UpdatePassword(_passwordHasher.HashPassword(user.Email, newPassword));
        user.ClearPasswordResetToken();
        await dbContext.SaveChangesAsync(cancellationToken);
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
            canEdit,
            user.DisplayName,
            user.AvatarUrl);
    }
}
