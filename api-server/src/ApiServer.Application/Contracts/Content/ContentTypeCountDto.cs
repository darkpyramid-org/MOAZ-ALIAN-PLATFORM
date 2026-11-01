using ApiServer.Domain.Enums;

namespace ApiServer.Application.Contracts.Content;

/// <summary>How many records of each type exist, for the library index headers.</summary>
public sealed record ContentTypeCountDto(ContentType Type, int Count);
