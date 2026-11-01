using System.Text.RegularExpressions;

namespace ApiServer.Domain.Common;

/// <summary>
/// URL identifier generation. Arabic letters and digits are preserved (the platform's
/// slugs are Arabic), everything else collapses into single hyphens.
/// </summary>
/// <remarks>
/// Named <c>Slugs</c> rather than <c>Slug</c> so it never collides with the
/// <c>ContentItem.Slug</c> property that consumes it.
/// </remarks>
public static partial class Slugs
{
    public const int MaxLength = 200;

    /// <summary>Any run of characters that is not a letter or a digit.</summary>
    [GeneratedRegex(@"[^\p{L}\p{Nd}]+", RegexOptions.CultureInvariant)]
    private static partial Regex UnsupportedRuns();

    [GeneratedRegex(@"^-+|-+$", RegexOptions.CultureInvariant)]
    private static partial Regex EdgeHyphens();

    /// <summary>
    /// Returns a normalised slug, or <see cref="string.Empty"/> when nothing usable remains
    /// (for example a slug made only of punctuation).
    /// </summary>
    public static string Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var lowered = raw.Trim().ToLowerInvariant();
        var hyphenated = UnsupportedRuns().Replace(lowered, "-");
        var trimmed = EdgeHyphens().Replace(hyphenated, string.Empty);

        if (trimmed.Length == 0)
        {
            return string.Empty;
        }

        return trimmed.Length > MaxLength
            ? trimmed[..MaxLength].TrimEnd('-')
            : trimmed;
    }

    /// <summary>Normalises and guarantees a usable slug, rejecting input that cannot produce one.</summary>
    public static string Required(string? raw)
    {
        var normalized = Normalize(raw);
        if (normalized.Length == 0)
        {
            throw new DomainException("Slug must contain at least one letter or digit.");
        }

        return normalized;
    }
}
