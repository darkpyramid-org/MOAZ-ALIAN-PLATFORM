using ApiServer.Application.Contracts.Auth;
using ApiServer.Application.Services;

namespace ApiServer.WebApi.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost(
            "/login",
            async (
                LoginRequest request,
                IAuthService authService,
                CancellationToken cancellationToken) =>
            {
                if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                {
                    return Results.BadRequest(new { title = "البريد الإلكتروني وكلمة المرور مطلوبان", status = 400 });
                }

                try
                {
                    var result = await authService.LoginAsync(request.Email, request.Password, cancellationToken);
                    return Results.Ok(result);
                }
                catch (UnauthorizedAccessException ex)
                {
                    return Results.Problem(
                        detail: ex.Message,
                        statusCode: StatusCodes.Status401Unauthorized,
                        title: "فشل تسجيل الدخول");
                }
            })
            .WithName("AuthLogin")
            .WithSummary("Log in with email and password to receive a JWT access token.")
            .Produces<AuthResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost(
            "/register",
            async (
                RegisterRequest request,
                IAuthService authService,
                CancellationToken cancellationToken) =>
            {
                if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                {
                    return Results.BadRequest(new { title = "البريد الإلكتروني وكلمة المرور مطلوبان", status = 400 });
                }

                try
                {
                    var result = await authService.RegisterAsync(request.Email, request.Password, cancellationToken);
                    return Results.Ok(result);
                }
                catch (InvalidOperationException ex)
                {
                    return Results.Problem(
                        detail: ex.Message,
                        statusCode: StatusCodes.Status409Conflict,
                        title: "حساب موجود");
                }
            })
            .WithName("AuthRegister")
            .WithSummary("Register a new user account.")
            .Produces<AuthResponse>()
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapGet(
            "/me",
            async (
                IAuthService authService,
                CancellationToken cancellationToken) =>
            {
                var user = await authService.GetCurrentUserAsync(cancellationToken);
                if (user is null)
                {
                    return Results.Unauthorized();
                }

                return Results.Ok(user);
            })
            .RequireAuthorization()
            .WithName("AuthMe")
            .WithSummary("Get profile and role details of the current authenticated user.")
            .Produces<AuthUserDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return group;
    }
}

