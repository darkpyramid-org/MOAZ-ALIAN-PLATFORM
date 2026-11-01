namespace ApiServer.Application.Common;

/// <summary>
/// Tuning for the public read cache. Bound from configuration in Infrastructure so the
/// thresholds can change per environment without recompiling a use case.
/// </summary>
public sealed class ContentCacheOptions
{
    public const string SectionName = "ContentCache";

    /// <summary>Listing pages are the hottest endpoint; short TTL keeps them fresh after edits.</summary>
    public TimeSpan QueryTtl { get; set; } = TimeSpan.FromSeconds(45);

    /// <summary>A single detail page changes rarely enough to live longer than the list.</summary>
    public TimeSpan ItemTtl { get; set; } = TimeSpan.FromMinutes(2);

    public TimeSpan CountsTtl { get; set; } = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Turning this off makes every read go to SQL. Useful when comparing API output against
    /// the database during a migration, and it costs nothing to keep.
    /// </summary>
    public bool Enabled { get; set; } = true;
}
