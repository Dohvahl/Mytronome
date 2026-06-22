using PresetApi.Models;
using PresetApi.Stores;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Generates the OpenAPI document (served at /openapi/v1.json in development).
builder.Services.AddOpenApi();

// Our preset storage. In-memory for now; swapped for MySQL in slice 3.2.
builder.Services.AddSingleton<IPresetStore, InMemoryPresetStore>();

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // interactive API docs at /scalar
}

// NOTE: no HTTPS redirect in dev — we serve plain HTTP locally and handle TLS
// at deployment (and in slice 3.4). This keeps local CORS/testing simple.

app.UseCors(WebClientPolicy);

// --- Preset endpoints -----------------------------------------------------
var presets = app.MapGroup("/api/presets");

presets.MapGet("/", (IPresetStore store) => store.List());

presets.MapGet("/{id}", (string id, IPresetStore store) =>
    store.Get(id) is { } preset ? Results.Ok(preset) : Results.NotFound());

presets.MapPut("/{id}", (string id, Preset preset, IPresetStore store) =>
{
    if (preset.Id != id)
        return Results.BadRequest("The preset id in the body must match the URL.");

    store.Save(preset);
    return Results.NoContent();
});

presets.MapDelete("/{id}", (string id, IPresetStore store) =>
    store.Remove(id) ? Results.NoContent() : Results.NotFound());

app.Run();
