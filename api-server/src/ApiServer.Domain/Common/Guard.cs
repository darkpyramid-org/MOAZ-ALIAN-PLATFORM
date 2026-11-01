using System.Text.RegularExpressions;

namespace ApiServer.Domain.Common;

/// <summary>
/// Invariant checks for values entering an aggregate. Fails fast with a readable
/// message so a bad value can never be persisted.
/// </summary>
public static class Guard
{
    /// <summary>Rejects null/whitespace and over-length input; returns the trimmed value.</summary>
    public static string Required(string? value, string name, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException($"{name} is required.");
        }

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
        {
            throw new DomainException($"{name} must be at most {maxLength} characters (got {trimmed.Length}).");
        }

        return trimmed;
    }

    /// <summary>Trims and nullifies blank optional text, so "" is never stored.</summary>
    public static string? Optional(string? value, int maxLength, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
        {
            throw new DomainException($"{name} must be at most {maxLength} characters (got {trimmed.Length}).");
        }

        return trimmed;
    }

    public static T Enum<T>(T value, string name)
        where T : struct, Enum
    {
        if (!System.Enum.IsDefined(value))
        {
            throw new DomainException($"{name} has an unsupported value ({value}).");
        }

        return value;
    }

    public static void Range(int? value, int minimum, int maximum, string name)
    {
        if (value.HasValue && (value.Value < minimum || value.Value > maximum))
        {
            throw new DomainException($"{name} must be between {minimum} and {maximum}.");
        }
    }

    /// <summary>
    /// Validates an absolute http(s) URL. Compared with <see cref="System.Uri"/> rather than a
    /// regex so internationalised and query-heavy media links are accepted correctly.
    /// </summary>
    public static string? Url(string? value, string name, int maxLength)
    {
        var trimmed = Optional(value, maxLength, name);
        if (trimmed is null)
        {
            return null;
        }

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var parsed)
            || (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps))
        {
            throw new DomainException($"{name} must be a valid absolute http(s) URL.");
        }

        return trimmed;
    }

    /// <summary>Removes duplicates without reordering, comparing case-insensitively so tags behave
    /// consistently regardless of how the database collation sorts them.</summary>
    public static string[] DistinctValues(IEnumerable<string> values, string name, int maxLength)
    {
        ArgumentNullException.ThrowIfNull(values);

        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var raw in values)
        {
            var value = Required(raw, name, maxLength);
            if (seen.Add(value))
            {
                result.Add(value);
            }
        }

        return [.. result];
    }
}
