namespace ApiServer.Application.Abstractions.Persistence;

/// <summary>
/// Commits one business operation. A content write and its category links share a single
/// DbContext, so this one call is already atomic — an explicit transaction wrapper would add
/// ceremony without adding safety at this scope.
/// </summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
