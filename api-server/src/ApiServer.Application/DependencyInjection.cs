using ApiServer.Application.Services;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace ApiServer.Application;

/// <summary>
/// Application-layer wiring. The composition root in WebApi calls this; use cases never
/// discover each other through a service locator.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        // One registration line covers every current and future validator in this assembly.
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<IContentService, ContentService>();
        services.AddScoped<ICategoryService, CategoryService>();

        return services;
    }
}
