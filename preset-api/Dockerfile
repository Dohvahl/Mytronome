# ---- Build stage: compile & publish with the .NET SDK ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, on its own layer, so dependency restore is cached across builds.
COPY preset-api.csproj .
RUN dotnet restore preset-api.csproj

# Copy the rest of the source and publish a release build.
COPY . .
RUN dotnet publish preset-api.csproj -c Release -o /app /p:UseAppHost=false

# ---- Runtime stage: small image with just the ASP.NET runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
# .NET container images listen on 8080 by default.
EXPOSE 8080
ENTRYPOINT ["dotnet", "preset-api.dll"]
