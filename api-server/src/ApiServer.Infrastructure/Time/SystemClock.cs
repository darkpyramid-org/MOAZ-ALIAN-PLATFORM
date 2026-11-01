using ApiServer.Application.Abstractions;

namespace ApiServer.Infrastructure.Time;

/// <summary>The only place the wall clock is read.</summary>
public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
