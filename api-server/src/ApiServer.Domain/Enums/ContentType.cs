namespace ApiServer.Domain.Enums;

/// <summary>
/// The four library shapes the frontend renders. Persisted as a smallint to keep
/// indexes narrow; the API serialises the lower-case name the frontend already expects.
/// </summary>
public enum ContentType
{
    Video = 1,
    Book = 2,
    Article = 3,
    Research = 4,
}
