namespace ApiServer.Domain.Enums;

/// <summary>
/// Embedded video host. Only YouTube is supported today; kept as an enum so adding a provider
/// is additive. Spelled <c>Youtube</c> so camelCase JSON serialisation produces exactly the
/// "youtube" string the frontend's <c>videoProvider</c> union member expects.
/// </summary>
public enum VideoProvider
{
    Youtube = 1,
}
