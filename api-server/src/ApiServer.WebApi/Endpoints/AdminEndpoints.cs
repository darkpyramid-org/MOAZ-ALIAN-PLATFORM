using System.Data.Common;
using System.Text.Json;
using ApiServer.Infrastructure.Persistence;
using ApiServer.WebApi.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiServer.WebApi.Endpoints;

public sealed record RoleToggleRequest(string Role, bool Has);

public sealed record DebateDto(
    Guid? Id,
    string GuestName,
    string? GuestBackground,
    string Topic,
    string? ReplySummary,
    string Outcome,
    string? DebateDate,
    string? VideoUrl,
    string[]? Tags,
    string? Notes,
    DateTimeOffset? CreatedAt);

public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Admin");

        // -------------------------------------------------------------
        // Users & Roles
        // -------------------------------------------------------------
        group.MapGet("/users", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var users = await db.Users
                .OrderBy(u => u.CreatedAt)
                .Select(u => new
                {
                    id = u.Id.ToString(),
                    email = u.Email,
                    display_name = u.Email.Split('@', StringSplitOptions.None)[0],
                    created_at = u.CreatedAt,
                    roles = u.Roles
                })
                .ToListAsync(ct);

            return Results.Ok(users);
        })
        .RequireAuthorization(AuthorizationPolicies.SiteAdmin)
        .WithName("AdminListUsers");

        group.MapPost("/users/{id:guid}/roles", async (
            Guid id,
            [FromBody] RoleToggleRequest req,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var user = await db.Users.FindAsync([id], ct);
            if (user is null) return Results.NotFound();

            var roles = user.Roles.ToList();
            if (req.Has)
            {
                roles.RemoveAll(r => string.Equals(r, req.Role, StringComparison.OrdinalIgnoreCase));
            }
            else
            {
                if (!roles.Contains(req.Role, StringComparer.OrdinalIgnoreCase))
                {
                    roles.Add(req.Role.ToLowerInvariant());
                }
            }
            user.UpdateRoles(roles);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { success = true, roles = user.Roles });
        })
        .RequireAuthorization(AuthorizationPolicies.SiteAdmin)
        .WithName("AdminToggleUserRole");

        // -------------------------------------------------------------
        // Site Settings
        // -------------------------------------------------------------
        group.MapGet("/settings/{id?}", async (string? id, ApplicationDbContext db, CancellationToken ct) =>
        {
            var targetId = id ?? "main";
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT \"Data\", \"UpdatedAt\" FROM library.site_settings WHERE \"Id\" = @id LIMIT 1";
            var p = cmd.CreateParameter();
            p.ParameterName = "@id";
            p.Value = targetId;
            cmd.Parameters.Add(p);

            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var json = reader.GetString(0);
                var updated = reader.GetDateTime(1);
                using var doc = JsonDocument.Parse(json);
                return Results.Ok(new { data = doc.RootElement.Clone(), version = updated.ToString("O") });
            }
            return Results.Ok(new { data = (object?)null, version = "default" });
        })
        .WithName("GetSiteSettings");

        group.MapPut("/settings/{id?}", async (
            string? id,
            [FromBody] JsonElement body,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var targetId = id ?? "main";
            var json = body.GetRawText();
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO library.site_settings (""Id"", ""Data"", ""UpdatedAt"")
                VALUES (@id, @data, NOW())
                ON CONFLICT (""Id"") DO UPDATE
                SET ""Data"" = EXCLUDED.""Data"", ""UpdatedAt"" = NOW();
            ";
            var pId = cmd.CreateParameter();
            pId.ParameterName = "@id";
            pId.Value = targetId;
            cmd.Parameters.Add(pId);

            var pData = cmd.CreateParameter();
            pData.ParameterName = "@data";
            pData.Value = json;
            cmd.Parameters.Add(pData);

            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
            await cmd.ExecuteNonQueryAsync(ct);
            return Results.Ok(new { success = true });
        })
        .RequireAuthorization(AuthorizationPolicies.ContentEditor)
        .WithName("UpdateSiteSettings");

        // -------------------------------------------------------------
        // Debates
        // -------------------------------------------------------------
        group.MapGet("/debates", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT ""Id"", ""GuestName"", ""GuestBackground"", ""Topic"", ""ReplySummary"",
                       ""Outcome"", ""DebateDate"", ""VideoUrl"", ""Tags"", ""Notes"", ""CreatedAt""
                FROM library.debates
                ORDER BY ""DebateDate"" DESC NULLS LAST, ""CreatedAt"" DESC;
            ";
            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var list = new List<object>();
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetGuid(0);
                var guestName = reader.GetString(1);
                var guestBackground = reader.IsDBNull(2) ? null : reader.GetString(2);
                var topic = reader.GetString(3);
                var replySummary = reader.IsDBNull(4) ? null : reader.GetString(4);
                var outcome = reader.GetString(5);
                var debateDate = reader.IsDBNull(6) ? null : reader.GetString(6);
                var videoUrl = reader.IsDBNull(7) ? null : reader.GetString(7);
                var tags = reader.IsDBNull(8) ? [] : (string[])reader.GetValue(8);
                var notes = reader.IsDBNull(9) ? null : reader.GetString(9);
                var createdAt = reader.GetDateTime(10);

                list.Add(new
                {
                    id,
                    guest_name = guestName,
                    guest_background = guestBackground,
                    topic,
                    reply_summary = replySummary,
                    outcome,
                    debate_date = debateDate,
                    video_url = videoUrl,
                    tags,
                    notes,
                    created_at = createdAt
                });
            }
            return Results.Ok(list);
        })
        .RequireAuthorization(AuthorizationPolicies.ContentEditor)
        .WithName("ListDebates");

        group.MapPost("/debates", async (
            [FromBody] DebateDto dto,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var id = Guid.NewGuid();
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO library.debates (""Id"", ""GuestName"", ""GuestBackground"", ""Topic"", ""ReplySummary"",
                                             ""Outcome"", ""DebateDate"", ""VideoUrl"", ""Tags"", ""Notes"", ""CreatedAt"")
                VALUES (@id, @guestName, @guestBackground, @topic, @replySummary,
                        @outcome, @debateDate, @videoUrl, @tags, @notes, NOW());
            ";
            AddDebateParams(cmd, id, dto);
            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
            await cmd.ExecuteNonQueryAsync(ct);
            return Results.Ok(new { id, success = true });
        })
        .RequireAuthorization(AuthorizationPolicies.ContentEditor)
        .WithName("CreateDebate");

        group.MapPut("/debates/{id:guid}", async (
            Guid id,
            [FromBody] DebateDto dto,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                UPDATE library.debates
                SET ""GuestName"" = @guestName,
                    ""GuestBackground"" = @guestBackground,
                    ""Topic"" = @topic,
                    ""ReplySummary"" = @replySummary,
                    ""Outcome"" = @outcome,
                    ""DebateDate"" = @debateDate,
                    ""VideoUrl"" = @videoUrl,
                    ""Tags"" = @tags,
                    ""Notes"" = @notes
                WHERE ""Id"" = @id;
            ";
            AddDebateParams(cmd, id, dto);
            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
            var affected = await cmd.ExecuteNonQueryAsync(ct);
            if (affected == 0) return Results.NotFound();
            return Results.Ok(new { id, success = true });
        })
        .RequireAuthorization(AuthorizationPolicies.ContentEditor)
        .WithName("UpdateDebate");

        group.MapDelete("/debates/{id:guid}", async (
            Guid id,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"DELETE FROM library.debates WHERE ""Id"" = @id;";
            var p = cmd.CreateParameter();
            p.ParameterName = "@id";
            p.Value = id;
            cmd.Parameters.Add(p);
            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
            var affected = await cmd.ExecuteNonQueryAsync(ct);
            if (affected == 0) return Results.NotFound();
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.ContentEditor)
        .WithName("DeleteDebate");

        return group;
    }

    private static void AddDebateParams(DbCommand cmd, Guid id, DebateDto dto)
    {
        void Add(string name, object? val)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = val ?? DBNull.Value;
            cmd.Parameters.Add(p);
        }

        Add("@id", id);
        Add("@guestName", dto.GuestName);
        Add("@guestBackground", dto.GuestBackground);
        Add("@topic", dto.Topic);
        Add("@replySummary", dto.ReplySummary);
        Add("@outcome", dto.Outcome ?? "open");
        Add("@debateDate", dto.DebateDate);
        Add("@videoUrl", dto.VideoUrl);
        Add("@tags", dto.Tags ?? Array.Empty<string>());
        Add("@notes", dto.Notes);
    }
}

