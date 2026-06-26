using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PresetApi.Data;

namespace PresetApi.Tests;

/// <summary>
/// Boots the real API in-memory (Microsoft.AspNetCore.Mvc.Testing) with the MySQL
/// DbContext swapped for EF Core InMemory, plus a helper to obtain an
/// authenticated client. Shared by the endpoint test classes.
/// </summary>
internal static class TestAppFactory
{
    public static WebApplicationFactory<Program> Create()
    {
        // One database name per factory, computed ONCE here — NOT inside the
        // options lambda, which runs per request scope and would otherwise hand
        // each request its own empty InMemory database.
        var databaseName = $"endpoint-tests-{Guid.NewGuid()}";

        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            // A non-Development environment skips the Dev-only startup Migrate()
            // (InMemory can't migrate) and the Scalar docs.
            builder.UseEnvironment("Testing");

            builder.ConfigureTestServices(services =>
            {
                // Drop the MySQL DbContext wiring (its options + the EF Core 9
                // IDbContextOptionsConfiguration that holds UseMySql) and swap in
                // a fresh InMemory database. Matched by type-name so this stays
                // robust across EF Core versions.
                var toRemove = services
                    .Where(d =>
                        d.ServiceType == typeof(DbContextOptions<PresetDbContext>) ||
                        d.ServiceType == typeof(DbContextOptions) ||
                        (d.ServiceType.IsGenericType &&
                         d.ServiceType.GetGenericTypeDefinition()
                             .Name.StartsWith("IDbContextOptionsConfiguration")))
                    .ToList();
                foreach (var d in toRemove)
                    services.Remove(d);

                services.AddDbContext<PresetDbContext>(options =>
                    options.UseInMemoryDatabase(databaseName));

                // Let a freshly-registered user log in without email confirmation.
                services.Configure<IdentityOptions>(options =>
                {
                    options.SignIn.RequireConfirmedAccount = false;
                    options.SignIn.RequireConfirmedEmail = false;
                    options.SignIn.RequireConfirmedPhoneNumber = false;
                });
            });
        });
    }

    /// <summary>Registers + logs in a user and returns a Bearer-authenticated client.</summary>
    public static async Task<HttpClient> CreateAuthenticatedClientAsync(
        this WebApplicationFactory<Program> app,
        string email = "tester@example.com",
        string password = "Test1234!")
    {
        var client = app.CreateClient();

        (await client.PostAsJsonAsync("/api/auth/register", new { email, password }))
            .EnsureSuccessStatusCode();

        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();

        var tokens = await login.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokens!.AccessToken);
        return client;
    }

    private sealed record LoginResponse(string AccessToken);
}
