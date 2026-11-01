namespace ApiServer.Application.Contracts.Categories;

/// <summary>
/// A browsing section, plus the content count the dashboard shows next to each row.
/// <c>ContentCount</c> is computed in SQL, never by loading the items.
/// </summary>
public sealed record CategoryDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string Description { get; init; } = string.Empty;

    public int SortOrder { get; init; }

    public int ContentCount { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>Write model shared by create and update; the id travels in the route.</summary>
public sealed record UpsertCategoryRequest
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? Description { get; init; }

    public int SortOrder { get; init; }
}
