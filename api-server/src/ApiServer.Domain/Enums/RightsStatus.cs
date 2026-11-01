namespace ApiServer.Domain.Enums;

/// <summary>
/// How the platform is allowed to carry a record. Mirrors the frontend's
/// <c>RightsStatus</c> so the API response can be consumed without translation.
/// </summary>
public enum RightsStatus
{
    /// <summary>Platform owns the material.</summary>
    Owned = 1,

    /// <summary>Used under an explicit licence.</summary>
    Licensed = 2,

    /// <summary>Metadata only; the reader is sent to the original publisher.</summary>
    External = 3,

    /// <summary>Not yet assessed — must not be surfaced as featured content.</summary>
    Unknown = 4,
}
