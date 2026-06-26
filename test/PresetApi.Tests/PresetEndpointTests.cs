using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace PresetApi.Tests;

/// <summary>
/// End-to-end checks on PUT /api/presets/{id}, focused on the input-validation
/// boundary: malformed bodies — explicit nulls, missing fields, bad pattern
/// contents, oversized values — must come back as 400 validation responses, never
/// a 500 from a null dereference inside the validator.
/// </summary>
public class PresetEndpointTests
{
    private const string Id = "abc";
    private static string Url => $"/api/presets/{Id}";

    /// <summary>A well-formed body; tests mutate one field to make it invalid.</summary>
    private static Dictionary<string, object?> ValidBody() =>
        new()
        {
            ["id"] = Id,
            ["label"] = "My preset",
            ["bpm"] = 120,
            ["timeSignature"] = new Dictionary<string, object?>
            {
                ["beats"] = 4,
                ["noteValue"] = 4,
            },
            ["pattern"] = new[] { "accent", "normal", "normal", "normal" },
        };

    [Fact]
    public async Task Valid_put_creates_the_preset()
    {
        using var app = TestAppFactory.Create();
        using var client = await app.CreateAuthenticatedClientAsync();

        var response = await client.PutAsJsonAsync(Url, ValidBody());

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Theory]
    [InlineData("label")]
    [InlineData("timeSignature")]
    [InlineData("pattern")]
    public async Task Explicit_null_required_field_is_a_400_not_a_500(string field)
    {
        using var app = TestAppFactory.Create();
        using var client = await app.CreateAuthenticatedClientAsync();

        var body = ValidBody();
        body[field] = null;

        var response = await client.PutAsJsonAsync(Url, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Missing_fields_yield_a_400_not_a_500()
    {
        using var app = TestAppFactory.Create();
        using var client = await app.CreateAuthenticatedClientAsync();

        // Only the id is present (it must still match the URL); all else absent.
        var body = new Dictionary<string, object?> { ["id"] = Id };

        var response = await client.PutAsJsonAsync(Url, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Malformed_pattern_contents_are_rejected()
    {
        using var app = TestAppFactory.Create();
        using var client = await app.CreateAuthenticatedClientAsync();

        var body = ValidBody();
        body["pattern"] = new object?[] { "accent", null, "normal", "normal" };

        var response = await client.PutAsJsonAsync(Url, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Oversized_label_is_rejected()
    {
        using var app = TestAppFactory.Create();
        using var client = await app.CreateAuthenticatedClientAsync();

        var body = ValidBody();
        body["label"] = new string('x', 201); // cap is 200

        var response = await client.PutAsJsonAsync(Url, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
