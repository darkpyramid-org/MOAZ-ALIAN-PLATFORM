using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using ApiServer.Application;
using ApiServer.Infrastructure;
using ApiServer.WebApi;
using ApiServer.WebApi.Auth;
using ApiServer.WebApi.Endpoints;
using ApiServer.WebApi.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;

// ============================================================================
// Composition root. The ONLY place that references both Application (ports) and
// Infrastructure (adapters) â€” everything else depends on abstractions, which is
// the dependency rule made physical by the project references.
// ============================================================================

var builder = WebApplication.CreateBuilder(args);

// ---- Machine-local overrides (e.g. the real JWT secret on the IIS host) ----
// Optional per-host file, never committed: `appsettings.{Environment}.user.json`
// wins over every committed JSON file, so a deployment carries its credentials
// without panel access and without the repo ever holding them. IIS environment
// variables set through the hosting panel take BOTH ranks above this file when
// explicitly configured there — the file exists so they do not have to be.
builder.Configuration.AddJsonFile(
    $"appsettings.{builder.Environment.EnvironmentName}.user.json",
    optional: true,
    reloadOnChange: false);

// ---- Application + Infrastructure (the two Add* calls wire every service,
// repository, reader, cache, clock, and the JWT authentication) ----
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// ---- JSON surface: enums travel as the lower-case names the frontend uses ----
// Property naming is already camelCase (JsonSerializerDefaults.Web); this adds the
// string enum representation so "video"/"owned"/"youtube" match src/types/content.ts.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

// ---- Errors: one Problem Details pipeline (GlobalExceptionHandler does the mapping) ----
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        // Lets a user report a failure and an operator find the matching log line.
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    };
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// ---- Authorization: policies delegate to ICurrentUser (see Auth/ for the why) ----
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AuthorizationPolicies.ContentEditor, p => p.AddRequirements(new ContentEditorRequirement()))
    .AddPolicy(AuthorizationPolicies.SiteAdmin, p => p.AddRequirements(new SiteAdminRequirement()));

builder.Services.AddScoped<IAuthorizationHandler, ContentEditorRequirementHandler>();
builder.Services.AddScoped<IAuthorizationHandler, SiteAdminRequirementHandler>();

// ---- CORS: browser calls from the frontend only. Deliberately NO credentials
// policy: the access token rides in the Authorization header, never a cookie,
// which keeps this API inert against CSRF by construction. ----
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
var allowVercelOrigins = builder.Configuration.GetValue<bool>("Cors:AllowVercelOrigins", false);

builder.Services.AddCors(options => options.AddPolicy(
    "frontend",
    policy =>
    {
        if (allowedOrigins is { Length: > 0 })
        {
            policy.WithOrigins(allowedOrigins);
        }
        else if (allowVercelOrigins)
        {
            // The frontend lives on Vercel, whose per-deployment subdomains change with
            // every publish: accept the platform's scheme instead of guessing URLs.
            // Writes stay protected by the JWT regardless — CORS here is only the
            // browser's preflight, not the authorization boundary.
            policy.SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                && uri.Host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase));
        }
        else if (builder.Environment.IsDevelopment())
        {
            // Vite dev-server ports move around; any localhost origin is fine locally.
            policy.SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                && (uri.Host == "localhost" || uri.Host == "127.0.0.1"));
        }
        else
        {
            return; // production with no configured origins: cross-origin is simply refused
        }

        policy.WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS").AllowAnyHeader();
    }));

// ---- Rate limiting: cheap DDoS damping at the edge. Numbers are generous on
// purpose â€” they stop abuse, not users; the public site's traffic pattern is a
// handful of list calls per page view. ----
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Global budget per visitor, keyed by user id when authenticated, IP otherwise.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
    {
        var identity = http.User.Identity?.Name ?? "ip:" + (http.Connection.RemoteIpAddress?.ToString() ?? "unknown");

        return RateLimitPartition.GetFixedWindowLimiter(identity, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 300,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        });
    });

    // Writes get their own, tighter bucket (a dashboard burst is scripted, not human).
    options.AddPolicy(RateLimitPolicies.Editorial, http =>
        RateLimitPartition.GetFixedWindowLimiter(http.User.Identity?.Name ?? "anon", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

// ---- Compression: listings and (when present) Markdown bodies are text-heavy.
// Smart mode keeps streaming working for chunked responses; static files would
// need a smarter provider we do not have, and we serve none. ----
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json", "application/problem+json"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = System.IO.Compression.CompressionLevel.Fastest);

// ---- Forwarded headers: behind any reverse proxy (the production norm), the
// real client IP â€” our rate-limit partition key â€” arrives in X-Forwarded-For. ----
builder.Services.Configure<ForwardedHeadersOptions>(options =>
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);

// ---- API docs: the native OpenAPI endpoint (/openapi/v1.json) + Swagger UI.
// Development-only by default; `Swagger:Enabled` lets a staging environment turn the
// live docs surface on without code changes. Production should not ship a public docs
// UI: consumers get the OpenAPI artifact from the build/deploy pipeline instead. ----
var swaggerEnabled =
    builder.Environment.IsDevelopment()
    || builder.Configuration.GetValue<bool>("Swagger:Enabled", false);

if (swaggerEnabled)
{
    builder.Services.AddOpenApi();
}

var app = builder.Build();

// Order matters: errors outermost so even a middleware rejection is Problem Details,
// then transport concerns (compression, TLS, CORS), then identity, then throttle.
app.UseExceptionHandler();

// Challenges (bare 401/403 from the auth middleware) and API-routed 404s skip the
// exception pipeline; give them the same JSON shape so the frontend has one parser.
app.UseStatusCodePages(async context =>
{
    var response = context.HttpContext.Response;
    response.ContentType = "application/problem+json";

    await response.WriteAsJsonAsync(
        new
        {
            title = response.StatusCode switch
            {
                StatusCodes.Status401Unauthorized => "Authentication required.",
                StatusCodes.Status403Forbidden => "Not allowed.",
                StatusCodes.Status404NotFound => "Not found.",
                StatusCodes.Status429TooManyRequests => "Too many requests.",
                _ => $"Request failed with status {response.StatusCode}.",
            },
            status = response.StatusCode,
            traceId = context.HttpContext.TraceIdentifier,
        });
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Must run before anything that reads RemoteIpAddress (the rate limiter's partition key).
// Defaults trust only loopback proxies; set ForwardedHeaders:KnownProxies in production
// config when hosted behind a known gateway rather than blanket-trusting headers.
app.UseForwardedHeaders();

app.UseResponseCompression();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapAdminEndpoints();
app.MapOAuthEndpoints();
app.MapContentEndpoints();
app.MapCategoryEndpoints();

// Ensure users, site_settings, and debates tables exist in the library schema
try
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApiServer.Infrastructure.Persistence.ApplicationDbContext>();
    await dbContext.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS library.users (
            ""Id"" UUID PRIMARY KEY,
            ""Email"" character varying(255) NOT NULL,
            ""PasswordHash"" character varying(1000) NOT NULL,
            ""Roles"" text[] NOT NULL DEFAULT ARRAY[]::text[],
            ""DisplayName"" character varying(80),
            ""AvatarUrl"" character varying(500000),
            ""PasswordResetToken"" character varying(200),
            ""PasswordResetExpiresAt"" timestamp(3) with time zone,
            ""CreatedAt"" timestamp(3) with time zone NOT NULL DEFAULT NOW(),
            ""UpdatedAt"" timestamp(3) with time zone
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_users_Email"" ON library.users (""Email"");
        -- Backfill columns on pre-existing databases.
        ALTER TABLE library.users ADD COLUMN IF NOT EXISTS ""DisplayName"" character varying(80);
        ALTER TABLE library.users ADD COLUMN IF NOT EXISTS ""AvatarUrl"" character varying(500000);
        ALTER TABLE library.users ALTER COLUMN ""AvatarUrl"" TYPE character varying(500000);
        ALTER TABLE library.users ADD COLUMN IF NOT EXISTS ""PasswordResetToken"" character varying(200);
        ALTER TABLE library.users ADD COLUMN IF NOT EXISTS ""PasswordResetExpiresAt"" timestamp(3) with time zone;
        ALTER TABLE library.users ADD COLUMN IF NOT EXISTS ""UpdatedAt"" timestamp(3) with time zone;

        CREATE TABLE IF NOT EXISTS library.site_settings (
            ""Id"" text PRIMARY KEY,
            ""Data"" text NOT NULL DEFAULT '{{}}',
            ""UpdatedAt"" timestamp(3) with time zone NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS library.debates (
            ""Id"" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            ""GuestName"" text NOT NULL,
            ""GuestBackground"" text,
            ""Topic"" text NOT NULL,
            ""ReplySummary"" text,
            ""Outcome"" text NOT NULL DEFAULT 'open',
            ""DebateDate"" text,
            ""VideoUrl"" text,
            ""Tags"" text[] NOT NULL DEFAULT ARRAY[]::text[],
            ""Notes"" text,
            ""CreatedAt"" timestamp(3) with time zone NOT NULL DEFAULT NOW()
        );
    ");
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Could not ensure library tables exist during startup.");
}

// Liveness/readiness for the host (container probes, uptime checks). Anonymous on
// purpose: it reports only "ok", never schema, counts, or connection details.
app.MapHealthChecks("/health");

if (swaggerEnabled)
{
    app.MapOpenApi();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/openapi/v1.json", "MOAZ ALIAN Library API v1");
        c.RoutePrefix = "swagger";
    });

    // With the docs surface on, navigating to root lands in Swagger UI
    app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
}
else
{
    app.MapGet("/", () => Results.Ok(new { status = "online", service = "MOAZ ALIAN API", health = "/health" })).ExcludeFromDescription();
}

app.Run();
