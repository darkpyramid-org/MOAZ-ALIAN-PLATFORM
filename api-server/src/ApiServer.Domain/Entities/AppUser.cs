using ApiServer.Domain.Common;

namespace ApiServer.Domain.Entities;

public sealed class AppUser
{
    public const int EmailMaxLength = 255;
    public const int DisplayNameMaxLength = 80;
    public const int AvatarUrlMaxLength = 500;

    public Guid Id { get; private set; }
    public string Email { get; private set; } = default!;
    public string PasswordHash { get; private set; } = default!;
    public List<string> Roles { get; private set; } = [];
    public string? DisplayName { get; private set; }
    public string? AvatarUrl { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }

    private AppUser() { }

    public static AppUser Create(Guid id, string email, string passwordHash, IEnumerable<string> roles, DateTimeOffset now)
    {
        return new AppUser
        {
            Id = id == Guid.Empty ? Guid.NewGuid() : id,
            Email = Guard.Required(email, "Email", EmailMaxLength).Trim().ToLowerInvariant(),
            PasswordHash = Guard.Required(passwordHash, "PasswordHash", 1000),
            Roles = roles?.ToList() ?? [],
            CreatedAt = now
        };
    }

    public void UpdatePassword(string newHash)
    {
        PasswordHash = Guard.Required(newHash, "PasswordHash", 1000);
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateRoles(IEnumerable<string> roles)
    {
        Roles = roles?.ToList() ?? [];
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateProfile(string? displayName, string? avatarUrl)
    {
        if (displayName is not null)
        {
            var trimmed = displayName.Trim();
            DisplayName = string.IsNullOrWhiteSpace(trimmed) ? null : Guard.Required(trimmed, "DisplayName", DisplayNameMaxLength);
        }
        if (avatarUrl is not null)
        {
            var trimmed = avatarUrl.Trim();
            AvatarUrl = string.IsNullOrWhiteSpace(trimmed) ? null : Guard.Required(trimmed, "AvatarUrl", AvatarUrlMaxLength);
        }
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}

