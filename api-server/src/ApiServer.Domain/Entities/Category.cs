using ApiServer.Domain.Common;

namespace ApiServer.Domain.Entities;

/// <summary>
/// A browsing section of the library (عقيدة، فقه، ...). Own aggregate: categories are
/// edited independently of the content that points at them.
/// </summary>
public sealed class Category
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 1000;
    public const int IdMaxLength = 100;

    /// <summary>
    /// Linked content. Navigation only: the content aggregate owns the relationship, so EF can
    /// eager-load and count without letting edits cascade back. Get-only and filled in place —
    /// the same binding pattern EF Core expects for skip navigations.
    /// </summary>
    public ICollection<ContentItem> ContentItems { get; } = new List<ContentItem>();

    /// <summary>EF Core materialisation entry point.</summary>
    private Category()
    {
    }

    public string Id { get; private set; } = default!;

    public string Name { get; private set; } = default!;

    public string Description { get; private set; } = string.Empty;

    /// <summary>Manual display position; ties are broken by name in the query.</summary>
    public int SortOrder { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public static Category Create(
        string? id,
        string? name,
        string? description,
        int sortOrder,
        DateTimeOffset now)
    {
        var category = new Category
        {
            Id = Guard.Required(id, "Category id", IdMaxLength),
            Name = Guard.Required(name, "Category name", NameMaxLength),
            Description = Guard.Optional(description, DescriptionMaxLength, "Category description") ?? string.Empty,
            SortOrder = sortOrder,
        };

        category.Touch(now);
        return category;
    }

    public void Update(string? name, string? description, int sortOrder, DateTimeOffset now)
    {
        Name = Guard.Required(name, "Category name", NameMaxLength);
        Description = Guard.Optional(description, DescriptionMaxLength, "Category description") ?? string.Empty;
        SortOrder = sortOrder;
        Touch(now);
    }

    private void Touch(DateTimeOffset now)
    {
        var utc = now.ToUniversalTime();

        if (CreatedAt == default)
        {
            CreatedAt = utc;
        }

        UpdatedAt = utc;
    }
}
