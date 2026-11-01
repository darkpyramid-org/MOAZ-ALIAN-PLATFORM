using ApiServer.Application.Abstractions.Persistence;

namespace ApiServer.Infrastructure.Persistence;

public sealed class UnitOfWork(ApplicationDbContext database) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken) =>
        database.SaveChangesAsync(cancellationToken);
}
