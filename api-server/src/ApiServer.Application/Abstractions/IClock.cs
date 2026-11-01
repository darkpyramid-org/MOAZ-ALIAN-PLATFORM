namespace ApiServer.Application.Abstractions;

/// <summary>
/// Ambient time as a port. Domain methods receive the timestamp as an argument instead of
/// reading the clock, so use cases stay deterministic and testable without a mocking library.
/// </summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
