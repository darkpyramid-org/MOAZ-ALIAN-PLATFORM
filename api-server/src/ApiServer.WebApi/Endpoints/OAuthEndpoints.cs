using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ApiServer.Application.Contracts.Auth;
using ApiServer.Application.Services;
using ApiServer.Infrastructure.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace ApiServer.WebApi.Endpoints;

public static class OAuthEndpoints
{
    private const string StateCookie = "oauth_state";

    public static RouteGroupBuilder MapOAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth/oauth").WithTags("Auth");

        foreach (var provider in new[] { "google", "facebook" })
        {
            var p = provider;
            group.MapGet(
                $"/{p}",
                (IOptions<AuthOptions> options, HttpContext http) =>
                {
                    var cfg = GetProvider(options.Value, p);
                    if (cfg is null || !cfg.IsConfigured)
                    {
                        return Results.Problem(
                            detail: $"OAuth provider '{p}' is not configured. Set Auth:OAuth:{p}:ClientId/ClientSecret/RedirectUri.",
                            statusCode: StatusCodes.Status501NotImplemented,
                            title: "غير مُفعَّل");
                    }

                    var state = CreateSignedState(options.Value);

                    var redirectUri = cfg.RedirectUri!;
                    var authorizationEndpoint = cfg.AuthorizationEndpoint ?? DefaultAuthorizationEndpoint(p);
                    var scope = Uri.EscapeDataString(cfg.Scope);

                    var url =
                        $"{authorizationEndpoint}?client_id={Uri.EscapeDataString(cfg.ClientId!)}" +
                        $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
                        $"&response_type=code" +
                        $"&scope={scope}" +
                        $"&state={Uri.EscapeDataString(state)}";

                    return Results.Redirect(url);
                })
                .WithName($"OAuth{char.ToUpper(p[0], System.Globalization.CultureInfo.InvariantCulture)}{p[1..]}Challenge");

            group.MapGet(
                $"/{p}/callback",
                async (
                    string? code,
                    string? state,
                    string? error,
                    IOptions<AuthOptions> options,
                    IAuthService authService,
                    IHttpClientFactory httpClientFactory,
                    HttpContext http,
                    CancellationToken cancellationToken) =>
                {
                    if (!string.IsNullOrEmpty(error))
                    {
                        return Results.Redirect($"{options.Value.FrontendUrl}/auth?oauth_error={Uri.EscapeDataString(error)}");
                    }

                    var cfg = GetProvider(options.Value, p);
                    if (cfg is null || !cfg.IsConfigured)
                    {
                        return Results.Problem(detail: "Provider not configured.", statusCode: StatusCodes.Status501NotImplemented);
                    }

                    if (string.IsNullOrEmpty(state) || !VerifySignedState(options.Value, state))
                    {
                        return Results.BadRequest(new { title = "حالة OAuth غير صالحة", status = 400 });
                    }

                    if (string.IsNullOrEmpty(code))
                    {
                        return Results.BadRequest(new { title = "رمز التفويض مفقود", status = 400 });
                    }

                    try
                    {
                        var tokenEndpoint = cfg.TokenEndpoint ?? DefaultTokenEndpoint(p);
                        var userInfoEndpoint = cfg.UserInfoEndpoint ?? DefaultUserInfoEndpoint(p);

                        using var client = httpClientFactory.CreateClient();
                        var tokenResponse = await client.PostAsync(tokenEndpoint, new FormUrlEncodedContent(new Dictionary<string, string>
                        {
                            ["client_id"] = cfg.ClientId!,
                            ["client_secret"] = cfg.ClientSecret!,
                            ["code"] = code,
                            ["redirect_uri"] = cfg.RedirectUri!,
                            ["grant_type"] = "authorization_code",
                        }), cancellationToken);

                        if (!tokenResponse.IsSuccessStatusCode)
                        {
                            return Results.Redirect($"{options.Value.FrontendUrl}/auth?oauth_error=token_exchange_failed");
                        }

                        using var tokenDoc = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(cancellationToken));
                        var accessToken = tokenDoc.RootElement.TryGetProperty("access_token", out var at) ? at.GetString() : null;
                        if (string.IsNullOrEmpty(accessToken))
                        {
                            return Results.Redirect($"{options.Value.FrontendUrl}/auth?oauth_error=no_access_token");
                        }

                        using var userReq = new HttpRequestMessage(HttpMethod.Get, userInfoEndpoint);
                        userReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                        var userResponse = await client.SendAsync(userReq, cancellationToken);
                        if (!userResponse.IsSuccessStatusCode)
                        {
                            return Results.Redirect($"{options.Value.FrontendUrl}/auth?oauth_error=userinfo_failed");
                        }

                        using var userDoc = JsonDocument.Parse(await userResponse.Content.ReadAsStringAsync(cancellationToken));
                        var (email, name, avatar) = ExtractUserInfo(p, userDoc.RootElement);
                        if (string.IsNullOrEmpty(email))
                        {
                            return Results.Redirect($"{options.Value.FrontendUrl}/auth?oauth_error=no_email");
                        }

                        var auth = await authService.ExternalLoginAsync(email, name, avatar, p, cancellationToken);
                        return Results.Redirect($"{options.Value.FrontendUrl}/auth/oauth-callback?token={Uri.EscapeDataString(auth.Token)}");
                    }
                    catch (Exception ex)
                    {
                        return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway, title: "OAuth فشل");
                    }
                })
                .WithName($"OAuth{char.ToUpper(p[0], System.Globalization.CultureInfo.InvariantCulture)}{p[1..]}Callback");
        }

        return group;
    }

    private static AuthOptions.OAuthProviderOptions? GetProvider(AuthOptions options, string provider)
    {
        return options.OAuth.TryGetValue(provider, out var cfg) ? cfg : null;
    }

    private static string DefaultAuthorizationEndpoint(string provider) => provider switch
    {
        "google" => "https://accounts.google.com/o/oauth2/v2/auth",
        "facebook" => "https://www.facebook.com/v18.0/dialog/oauth",
        _ => throw new ArgumentOutOfRangeException(nameof(provider)),
    };

    private static string DefaultTokenEndpoint(string provider) => provider switch
    {
        "google" => "https://oauth2.googleapis.com/token",
        "facebook" => "https://graph.facebook.com/v18.0/oauth/access_token",
        _ => throw new ArgumentOutOfRangeException(nameof(provider)),
    };

    private static string DefaultUserInfoEndpoint(string provider) => provider switch
    {
        "google" => "https://openidconnect.googleapis.com/v1/userinfo",
        "facebook" => "https://graph.facebook.com/me?fields=id,name,email,picture.type(large)",
        _ => throw new ArgumentOutOfRangeException(nameof(provider)),
    };

    private static string CreateSignedState(AuthOptions options)
    {
        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var payload = $"{ts}.{nonce}";
        var sig = ComputeHmac(payload, options.JwtSecret ?? "");
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{payload}.{sig}"))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static bool VerifySignedState(AuthOptions options, string state)
    {
        try
        {
            var padded = state.Replace("-", "+").Replace("_", "/");
            switch (padded.Length % 4)
            {
                case 2: padded += "=="; break;
                case 3: padded += "="; break;
            }
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
            var parts = decoded.Split('.');
            if (parts.Length != 3) return false;
            if (!long.TryParse(parts[0], out var ts)) return false;
            var age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts;
            if (age < 0 || age > 600) return false; // 10 min
            var payload = $"{parts[0]}.{parts[1]}";
            var expected = ComputeHmac(payload, options.JwtSecret ?? "");
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(parts[2]));
        }
        catch
        {
            return false;
        }
    }

    private static string ComputeHmac(string data, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(data)));
    }
    private static (string? Email, string? Name, string? Avatar) ExtractUserInfo(string provider, JsonElement root)
    {
        if (provider == "google")
        {
            var email = root.TryGetProperty("email", out var e) ? e.GetString() : null;
            var name = root.TryGetProperty("name", out var n) ? n.GetString() : null;
            var avatar = root.TryGetProperty("picture", out var pic) ? pic.GetString() : null;
            return (email, name, avatar);
        }

        // facebook
        var fEmail = root.TryGetProperty("email", out var fe) ? fe.GetString() : null;
        var fName = root.TryGetProperty("name", out var fn) ? fn.GetString() : null;
        string? fAvatar = null;
        if (root.TryGetProperty("picture", out var pdata) && pdata.TryGetProperty("data", out var d) && d.TryGetProperty("url", out var u))
        {
            fAvatar = u.GetString();
        }
        return (fEmail, fName, fAvatar);
    }
}
