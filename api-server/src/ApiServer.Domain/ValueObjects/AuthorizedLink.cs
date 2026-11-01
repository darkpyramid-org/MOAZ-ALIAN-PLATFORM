using ApiServer.Domain.Common;

namespace ApiServer.Domain.ValueObjects;

/// <summary>
/// A clearly-labelled, authorised place to read a book. Value object: no identity,
/// compared by its contents. The positional form exists because EF's model builder must be
/// able to bind a constructor for the jsonb mapping; domain code enters through
/// <see cref="Create"/> or <see cref="Restore"/>, never the public constructor, so
/// validation still gates every caller-supplied value.
/// </summary>
public sealed record AuthorizedLink(string Label, string Url)
{
    public const int LabelMaxLength = 120;
    public const int UrlMaxLength = 2048;

    /// <summary>
    /// Creates a link from caller-supplied text. Parameters are nullable on purpose: rejecting
    /// blank or non-http(s) input is this factory's job, not the compiler's.
    /// </summary>
    public static AuthorizedLink Create(string? label, string? url)
    {
        var validLabel = Guard.Required(label, "Link label", LabelMaxLength);
        var validUrl = Guard.Url(url, "Link url", UrlMaxLength)
            ?? throw new DomainException("Link url is required.");

        return new AuthorizedLink(validLabel, validUrl);
    }

    /// <summary>Rehydrates a value already validated at write time (database reads).</summary>
    public static AuthorizedLink Restore(string label, string url) => new(label, url);
}
