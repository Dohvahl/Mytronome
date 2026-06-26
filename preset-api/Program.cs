using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PresetApi.Auth;
using PresetApi.Data;
using PresetApi.Models;
using PresetApi.Stores;
using PresetApi.Validation;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Don't advertise the server software in responses.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

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
    .AddEntityFrameworkStores<PresetDbContext>()
    .AddPasswordValidator<MaxLengthPasswordValidator<IdentityUser>>();
builder.Services.AddAuthorization();

// Rate limiting, partitioned by client IP. The "auth" policy guards the
// login/register endpoints against brute-force attempts.
const string AuthRateLimit = "auth";
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(AuthRateLimit, http =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
            }));
});

// Behind the nginx reverse proxy the real client IP arrives in X-Forwarded-For;
// honor it so the auth rate limiter partitions per real client, not per proxy.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    options.ForwardLimit = 1; // exactly one proxy (nginx) in front of the API
    // nginx connects from the Docker network (not loopback) with a dynamic IP we
    // can't pin, so clear the default allow-list and trust the immediate peer's
    // header. SAFE ONLY IF the API is reachable solely THROUGH the proxy — in
    // production, drop the public "5046:8080" port mapping so a direct caller can't
    // spoof X-Forwarded-For to evade the rate limit.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Allow the Vite dev client to call this API from the browser — scoped to the
// dev origin and only the methods/headers we actually use.
const string WebClientPolicy = "web-client";
builder.Services.AddCors(options =>
{
    options.AddPolicy(WebClientPolicy, policy =>
        policy.WithOrigins("http://localhost:5173")
            .WithMethods("GET", "POST", "PUT", "DELETE")
            .WithHeaders("Content-Type", "Authorization"));
});

var app = builder.Build();

// Apply pending EF migrations at startup in development only — convenient for
// local dev and the demo container. In production, run migrations as an explicit,
// controlled deploy step instead of racing them on every app start (and to avoid
// an unintended model change auto-altering the live schema). Also guarded against
// design-time tooling (e.g. `dotnet ef migrations add`).
if (app.Environment.IsDevelopment() && !EF.IsDesignTime)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PresetDbContext>();
    db.Database.Migrate();
}

// Resolve the real client IP from the proxy's X-Forwarded-For before anything that
// reads it (notably the rate limiter below).
app.UseForwardedHeaders();

// Baseline security headers on every response. (No Content-Security-Policy here —
// it would break the Scalar docs UI; the web app's CSP is set by nginx instead.)
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // interactive API docs at /scalar
}

// NOTE: no HTTPS redirect in dev — we serve plain HTTP locally and handle TLS
// at deployment (and in slice 3.4). This keeps local CORS/testing simple.

app.UseCors(WebClientPolicy);

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

// Identity endpoints: POST /api/auth/register, /api/auth/login, /api/auth/refresh, ...
var auth = app.MapGroup("/api/auth").RequireRateLimiting(AuthRateLimit);
auth.MapIdentityApi<IdentityUser>();

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

    var errors = PresetValidator.Validate(preset);
    if (errors.Count > 0)
        return Results.ValidationProblem(errors);

    var result = await store.SaveAsync(UserId(user), preset);
    return result switch
    {
        SaveResult.QuotaExceeded => Results.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Preset limit reached",
            detail: $"You can store at most {EfPresetStore.MaxPresetsPerOwner} presets."),
        SaveResult.IdConflict => Results.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Preset id already in use",
            detail: "That preset id is already taken. Use a different id."),
        _ => Results.NoContent(),
    };
});

presets.MapDelete("/{id}", async (string id, ClaimsPrincipal user, IPresetStore store) =>
    await store.RemoveAsync(UserId(user), id) ? Results.NoContent() : Results.NotFound());

app.Run();

// The authenticated user's id (Identity stores it as the NameIdentifier claim).
static string UserId(ClaimsPrincipal user) =>
    user.FindFirstValue(ClaimTypes.NameIdentifier)!;
