using ApiServer.Application.Contracts.Content;
using ApiServer.Domain.Enums;
using FluentValidation;
using FluentValidation.Results;

namespace ApiServer.WebApi.Endpoints;

/// <summary>
/// The query string as HTTP delivers it, translated into the Application layer's
/// <see cref="ContentQuery"/>.
/// <para>
/// Enums deliberately travel here as plain strings: the minimal-API parameter binder
/// has no conversion convention for them (only TryParse-shaped types), so binding
/// <see cref="ContentQuery"/> with [AsParameters] fails at runtime on <c>?type=book</c>.
/// Parsing here keeps that transport quirk out of the Application contract, gives
/// case-insensitive values matching the JSON names, and yields field-level 400s for
/// anything unrecognised instead of a silent default.
/// </para>
/// </summary>
public sealed record ContentQueryRequest
{
    public string? Type { get; init; }

    public string? CategoryId { get; init; }

    public string? Search { get; init; }

    public string? Series { get; init; }

    public bool? Featured { get; init; }

    public bool? Demo { get; init; }

    public string? Sort { get; init; }

    public int? Page { get; init; }

    public int? PageSize { get; init; }

    public ContentQuery ToQuery() => new()
    {
        Type = ParseEnum<ContentType>("type", Type),
        CategoryId = CategoryId,
        Search = Search,
        Series = Series,
        Featured = Featured,
        Demo = Demo,
        Sort = ParseEnum<ContentSort>("sort", Sort) ?? ContentSort.Newest,
        Page = Page ?? 1,
        PageSize = PageSize ?? ContentQuery.DefaultPageSize,
    };

    /// <summary>
    /// Absent or blank means "unset" (or the enum's default for <c>sort</c>); a value that
    /// matches no name is a client bug worth reporting, not a filter to quietly ignore.
    /// </summary>
    private static T? ParseEnum<T>(string field, string? raw)
        where T : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (Enum.TryParse<T>(raw, ignoreCase: true, out var parsed) && System.Enum.IsDefined(parsed))
        {
            return parsed;
        }

        throw new ValidationException([
            // The wire format is camelCase (JsonStringEnumConverter), so the hint must show
            // exactly what a client can send — not the CLR member names.
            new ValidationFailure(field, $"{field} must be one of: {string.Join(", ", System.Enum.GetNames<T>().Select(System.Text.Json.JsonNamingPolicy.CamelCase.ConvertName))}."),
        ]);
    }
}
