namespace ApiServer.Domain.Common;

/// <summary>
/// Thrown when an operation would break a domain invariant.
/// The HTTP layer maps this to 422; the domain itself knows nothing about status codes.
/// </summary>
public class DomainException : Exception
{
    public DomainException(string message)
        : base(message)
    {
    }
}
