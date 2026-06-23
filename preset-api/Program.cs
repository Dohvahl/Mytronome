using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PresetApi.Data;
using PresetApi.Models;
using PresetApi.Stores;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Generates the OpenAPI document (served at /openapi/v1.json in development).
builder.Services.AddOpenApi();

// Preset storage: MySQL via EF Core. The connection string comes from
// configuration (an env var in Docker, user-secrets for local dev) — never a
// real password hard-coded in a committed file.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<PresetDbContext>(options =>
    options.UseMySql(
        connectionString,
        new MySqlServerVersion(new Version(8, 0, 36)),
        mysql => mysql.EnableRetryOnFailure()));

builder.Services.AddScoped<IPresetStore, EfPresetStore>();

// ASP.NET Core Identity with token-based API endpoints (register/login/refresh),
// storing users in the same MySQL database via EF Core.
builder.Services
    .AddIdentityApiEndpoints<IdentityUser>()
    .AddEntityFrameworkStores<PresetDbContext>();
builder.Services.AddAuthorization();

// Allow the Vite dev client to call this API from the browser.
const string WebClientPolicy = "web-client";
builder.Services.AddCors(options =>
{
    options.AddPolicy(WebClientPolicy, policy =>
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

// Apply any pending EF migrations at startup so the schema is ready. Guarded so
// it does not run during design-time tooling (e.g. `dotnet ef migrations add`).
if (!EF.IsDesignTime)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PresetDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // interactive API docs at /scalar
}

// NOTE: no HTTPS redirect in dev — we serve plain HTTP locally and handle TLS
// at deployment (and in slice 3.4). This keeps local CORS/testing simple.

app.UseCors(WebClientPolicy);

app.UseAuthentication();
app.UseAuthorization();

// Identity endpoints: POST /api/auth/register, /api/auth/login, /api/auth/refresh, ...
app.MapGroup("/api/auth").MapIdentityApi<IdentityUser>();

// --- Preset endpoints (require a logged-in user; scoped to that user) ------
var presets = app.MapGroup("/api/presets").RequireAuthorization();

presets.MapGet("/", (ClaimsPrincipal user, IPresetStore store) =>
    store.ListAsync(UserId(user)));

presets.MapGet("/{id}", async (string id, ClaimsPrincipal user, IPresetStore store) =>
    await store.GetAsync(UserId(user), id) is { } preset
        ? Results.Ok(preset)
        : Results.NotFound());

presets.MapPut("/{id}", async (string id, Preset preset, ClaimsPrincipal user, IPresetStore store) =>
{
    if (preset.Id != id)
        return Results.BadRequest("The preset id in the body must match the URL.");

    await store.SaveAsync(UserId(user), preset);
    return Results.NoContent();
});

presets.MapDelete("/{id}", async (string id, ClaimsPrincipal user, IPresetStore store) =>
    await store.RemoveAsync(UserId(user), id) ? Results.NoContent() : Results.NotFound());

app.Run();

// The authenticated user's id (Identity stores it as the NameIdentifier claim).
static string UserId(ClaimsPrincipal user) =>
    user.FindFirstValue(ClaimTypes.NameIdentifier)!;
