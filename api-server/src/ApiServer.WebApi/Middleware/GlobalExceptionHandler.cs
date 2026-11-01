using System.Text.Json;
using ApiServer.Application.Common;
using ApiServer.Domain.Common;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ApiServer.WebApi.Middleware;

/// <summary>
/// The single place where domain/vocabulary failures become HTTP. Everything above the
/// transport throws the exceptions it finds natural; this maps them to Problem Details
/// (RFC 7807) responses that the frontend can branch on by <c>Status</c> and read
/// human-friendly text from <c>Title</c>/<c>Detail</c>.
/// </summary>
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    /// <summary>Web defaults (camelCase) shared by every problem response; safe to cache.</summary>
    private static readonly JsonSerializerOptions ProblemJsonOptions = new(JsonSerializerDefaults.Web);

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ProblemDetails problem;
        LogLevel logLevel;

        switch (exception)
        {
            // Client disconnected — nothing to report and nobody to report it to.
            case OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested:
                logger.LogDebug("Request aborted by the client: {Message}", exception.Message);
                return true;

            case ValidationException validationException:
                // FluentValidation collected every field error; hand them back as one 400.
                var errors = validationException.Errors
                    .GroupBy(f => f.PropertyName)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(f => f.ErrorMessage).Distinct().ToArray());

                problem = new ValidationProblemDetails(errors)
                {
                    Title = "The request is not valid.",
                    Status = StatusCodes.Status400BadRequest,
                    Type = "https://httpstatuses.com/400",
                };
                logLevel = LogLevel.Debug; // wrong input is routine, not alarming
                break;

            // Body failed to deserialise (missing required field, bad enum name, wrong type).
            case JsonException jsonException:
                problem = new ProblemDetails
                {
                    Title = "The request body could not be read.",
                    Detail = jsonException.Path is null
                        ? jsonException.Message
                        : $"{jsonException.Message} (at path '{jsonException.Path}')",
                    Status = StatusCodes.Status400BadRequest,
                    Type = "https://httpstatuses.com/400",
                };
                logLevel = LogLevel.Debug;
                break;

            case NotFoundException notFound:
                problem = new ProblemDetails
                {
                    Title = $"{notFound.ResourceName} not found.",
                    Detail = notFound.Message,
                    Status = StatusCodes.Status404NotFound,
                    Type = "https://httpstatuses.com/404",
                };
                logLevel = LogLevel.Information;
                break;

            // A broken invariant is semantically invalid input: 422 distinguishes it from 400.
            case DomainException domainException:
                problem = new ProblemDetails
                {
                    Title = "The content violates a business rule.",
                    Detail = domainException.Message,
                    Status = StatusCodes.Status422UnprocessableEntity,
                    Type = "https://httpstatuses.com/422",
                };
                logLevel = LogLevel.Debug;
                break;

            case ConflictException conflict:
                problem = new ProblemDetails
                {
                    Title = "The write conflicts with existing data.",
                    Detail = conflict.Message,
                    Status = StatusCodes.Status409Conflict,
                    Type = "https://httpstatuses.com/409",
                };
                logLevel = LogLevel.Debug;
                break;

            case ForbiddenException forbidden:
                problem = new ProblemDetails
                {
                    Title = "Not allowed.",
                    Detail = forbidden.Message,
                    Status = StatusCodes.Status403Forbidden,
                    Type = "https://httpstatuses.com/403",
                };
                logLevel = LogLevel.Information;
                break;

            default:
                // Anything else is a bug or an outage: log the full exception, tell the client nothing.
                logger.LogError(exception, "Unhandled exception while processing {Method} {Path}",
                    httpContext.Request.Method, httpContext.Request.Path);

                problem = new ProblemDetails
                {
                    Title = "An unexpected error occurred.",
                    Detail = "The error has been logged. Please try again later.",
                    Status = StatusCodes.Status500InternalServerError,
                    Type = "https://httpstatuses.com/500",
                };
                logLevel = LogLevel.None; // already logged above
                break;
        }

        if (logLevel is not LogLevel.None)
        {
            logger.Log(logLevel, "{Title} {Detail}", problem.Title, problem.Detail);
        }

        problem.Instance = httpContext.Request.Path;
        httpContext.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        httpContext.Response.ContentType = "application/problem+json";

        // Explicit serialisation at the problem's runtime type so ValidationProblemDetails'
        // "errors" dictionary survives; a ProblemDetails-typed generic would drop it.
        var payload = JsonSerializer.Serialize(problem, problem.GetType(), ProblemJsonOptions);
        await httpContext.Response.WriteAsync(payload, cancellationToken);

        return true;
    }
}
