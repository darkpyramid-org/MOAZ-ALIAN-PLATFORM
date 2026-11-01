# Production image for the MOAZ ALIAN library API.
# Build (from api-server/):  docker build -t moaz-alian-api .
# Run:                     docker run -p 5199:5199 \
#                            -e ConnectionStrings__Postgres="<...>" \
#                            -e Auth__JwtSecret="<32+ chars>" \
#                            -e Auth__Issuer="https://api.example.com" \
#                            -e Cors__AllowedOrigins__0="https://your-frontend" \
#                            moaz-alian-api
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Project files first: the restore layer only invalidates when dependencies change.
COPY ApiServer.sln ./
COPY src/ ./src/
RUN dotnet restore ApiServer.sln

COPY src/ ./src/
RUN dotnet publish src/ApiServer.WebApi/ApiServer.WebApi.csproj \
    -c Release \
    -o /app \
    --no-restore \
    /p:UseAppHost=true

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app .

# One container, one concern: the API. TLS terminates at the platform's edge
# (load balancer / ingress / reverse proxy), so plain HTTP on the internal port.
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:5199
EXPOSE 5199

ENTRYPOINT ["dotnet", "ApiServer.WebApi.dll"]
