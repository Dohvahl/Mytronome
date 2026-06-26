using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PresetApi.Data;
using Xunit;

namespace PresetApi.Tests;

/// <summary>
/// Boots the real API in-memory (Microsoft.AspNetCore.Mvc.Testing) with the
/// MySQL DbContext swapped for EF Core InMemory, to verify that the /api/presets
/// routes actually enforce authentication.
/// </summary>
public class AuthorizationTests
{
    private static WebApplicationFactory<Program> CreateApp()
    {
        // One database name per factory, computed ONCE here — NOT inside the
        // options lambda, which runs per request scope and would otherwise hand
        // each request its own empty InMemory database.
        var databaseName = $"auth-tests-{Guid.NewGuid()}";

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

    [Theory]
    [InlineData("GET", "/api/presets")]
    [InlineData("GET", "/api/presets/some-id")]
    [InlineData("PUT", "/api/presets/some-id")]
    [InlineData("DELETE", "/api/presets/some-id")]
    public async Task Preset_routes_reject_unauthenticated_requests(
        string method,
        string path)
    {
        using var app = CreateApp();
        using var client = app.CreateClient();

        var response = await client.SendAsync(
            new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task An_authenticated_user_can_list_their_presets()
    {
        using var app = CreateApp();
        using var client = app.CreateClient();

        const string email = "tester@example.com";
        const string password = "Test1234!";

        // Register + log in through the real Identity endpoints to get a token.
        (
            await client.PostAsJsonAsync(
                "/api/auth/register",
                new { email, password }
            )
        ).EnsureSuccessStatusCode();

        var login = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email, password });
        if (!login.IsSuccessStatusCode)
        {
            Assert.Fail(
                $"Login failed ({(int)login.StatusCode}): "
                    + await login.Content.ReadAsStringAsync());
        }
        var tokens = await login.Content.ReadFromJsonAsync<LoginResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            tokens!.AccessToken);

        var response = await client.GetAsync("/api/presets");

        response.EnsureSuccessStatusCode(); // 200, not 401
        var presets = await response.Content.ReadFromJsonAsync<object[]>();
        Assert.Empty(presets!);
    }

    private sealed record LoginResponse(string AccessToken);
}
