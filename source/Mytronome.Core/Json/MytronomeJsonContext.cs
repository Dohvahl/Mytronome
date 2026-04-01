using System.Text.Json.Serialization;
using Mytronome.Core.Models;

namespace Mytronome.Core.Json;

/// <summary>
/// Source-generated JSON serializer context for Mytronome types.
///
/// The [JsonSerializable] attribute tells the compiler to generate serialization code
/// at build time instead of using runtime reflection. This is faster, AOT-compatible
/// (required for iOS), and produces smaller binaries.
///
/// Any type you need to serialize/deserialize must be listed here.
/// </summary>
[JsonSerializable(typeof(List<MetronomePreset>))]
public partial class MytronomeJsonContext : JsonSerializerContext
{
}
