using System.Text.Json;
using ApiServer.Application.Abstractions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace ApiServer.Infrastructure.Auth;

/// <summary>
/// Reads identity from the validated Supabase JWT.
/// <para>
/// Roles come from the token's <c>app_metadata.roles</c> array (the platform's
/// <c>user_roles</c> table mirrored into Supabase app metadata). Anything read from the
/// request headers or database after the fact could drift from the signature that authorised
/// this call, so nothing here consults any other source.
/// </para>
/// </summary>
public sealed class ClaimsCurrentUser(
    IHttpContextAccessor httpContextAccessor,
    IOptions<SupabaseAuthOptions> authOptions) : ICurrentUser
{
    private readonly SupabaseAuthOptions _authOptions = authOptions.Value;
    private IReadOnlyList<string>? _roles;

    public bool IsAuthenticated => httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public string? UserId => httpContextAccessor.HttpContext?.User.FindFirst(_authOptions.UserIdClaimType)?.Value;

    public IReadOnlyCollection<string> Roles => _roles ??= ReadRoles();

    public bool IsAdmin =>
        IsAuthenticated
        && (Roles.Contains(_authOptions.AdminRole, StringComparer.OrdinalIgnoreCase)
            || Roles.Contains(_authOptions.ServiceRole, StringComparer.OrdinalIgnoreCase));

    public bool CanEditContent =>
        IsAdmin
        || (IsAuthenticated && Roles.Contains(_authOptions.EditorRole, StringComparer.OrdinalIgnoreCase));

    private List<string> ReadRoles()
    {
        var principal = httpContextAccessor.HttpContext?.User;
        if (principal is null)
        {
            return [];
        }

        var roles = new List<string>();

        // The plain GoTrue role ("authenticated", "anon", "service_role") is a claim in its own right.
        foreach (var claim in principal.FindAll("role"))
        {
            roles.Add(claim.Value);
        }

        // Custom app roles are mirrored into app_metadata by the platform, so they ride the
        // signature. A JWT claim holding a JSON object arrives as raw JSON text.
        var metadata = principal.FindFirst(_authOptions.RolesMetadataClaimType)?.Value;
        if (!string.IsNullOrWhiteSpace(metadata))
        {
            TryAppendRoles(roles, metadata);
        }

        // Flat "roles" claim for deployments that put the array at the token root instead.
        foreach (var claim in principal.FindAll("roles"))
        {
            if (claim.Value.TrimStart().StartsWith('['))
            {
                TryAppendRoles(roles, claim.Value);
            }
            else
            {
                roles.Add(claim.Value);
            }
        }

        return roles;
    }

    private static void TryAppendRoles(List<string> roles, string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);

            // Accepts both shapes: a bare array and the real app_metadata object, whose
            // roles live under a "roles" property ({"roles":["admin"], …}).
            JsonElement array = document.RootElement.ValueKind switch
            {
                JsonValueKind.Array => document.RootElement,
                JsonValueKind.Object
                    when document.RootElement.TryGetProperty("roles", out var nested)
                         && nested.ValueKind == JsonValueKind.Array => nested,
                _ => default,
            };

            if (array.ValueKind != JsonValueKind.Array)
            {
                return;
            }

            foreach (var element in array.EnumerateArray())
            {
                if (element.ValueKind == JsonValueKind.String && element.GetString() is { Length: > 0 } role)
                {
                    roles.Add(role);
                }
            }
        }
        catch (JsonException)
        {
            // A malformed claim must never become a privilege. Treat it as "no extra roles".
        }
    }
}
