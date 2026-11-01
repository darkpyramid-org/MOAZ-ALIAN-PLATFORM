using ApiServer.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ApiServer.Infrastructure.Persistence.Configurations;

public sealed class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("users");

        builder.HasKey(user => user.Id);

        builder.Property(user => user.Email)
            .HasMaxLength(AppUser.EmailMaxLength)
            .IsRequired();

        builder.HasIndex(user => user.Email).IsUnique();

        builder.Property(user => user.PasswordHash)
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(user => user.Roles)
            .HasColumnType("text[]");

        builder.Property(user => user.DisplayName)
            .HasMaxLength(AppUser.DisplayNameMaxLength);

        builder.Property(user => user.AvatarUrl)
            .HasMaxLength(AppUser.AvatarUrlMaxLength);

        builder.Property(user => user.PasswordResetToken)
            .HasMaxLength(200);

        builder.Property(user => user.PasswordResetExpiresAt).HasPrecision(3);

        builder.Property(user => user.CreatedAt).HasPrecision(3);
        builder.Property(user => user.UpdatedAt).HasPrecision(3);
    }
}

