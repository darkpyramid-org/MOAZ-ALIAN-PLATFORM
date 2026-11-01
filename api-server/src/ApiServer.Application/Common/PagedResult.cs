namespace ApiServer.Application.Common;

/// <summary>
/// A bounded page of results. <see cref="TotalCount"/> is the real row count so the
/// frontend can render pagination without a second query.
/// </summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize == 0 ? 0 : (TotalCount + PageSize - 1) / PageSize;

    public bool HasNextPage => Page < TotalPages;
}
