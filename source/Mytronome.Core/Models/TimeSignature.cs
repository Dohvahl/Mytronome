using System.ComponentModel;

namespace Mytronome.Core.Models;

/// <summary>
/// Represents a musical time signature (e.g., 4/4, 3/4, 6/8).
/// The numerator is beats per measure; the denominator is the note value that gets one beat.
/// </summary>
public readonly record struct TimeSignature
{
    private readonly int _numerator;
    private readonly int _denominator;

    public TimeSignature(int numerator, int denominator)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(numerator, 1);
		// The denominator represents the note value that gets one beat. It must be a power of 2.
		if (!IsPowerOfTwo(denominator))
		{
			throw new ArgumentOutOfRangeException(nameof(denominator), "The denominator must be a power of 2.");
		}

        _numerator = numerator;
        _denominator = denominator;
    }

    /// <summary>
    /// How many beats the metronome counts per measure before resetting.
    /// </summary>
    public readonly int BeatsPerMeasure => _numerator;

    // Common presets
    private static readonly TimeSignature CommonTime = new(4, 4);
    private static readonly TimeSignature Waltz = new(3, 4);
    private static readonly TimeSignature SixEight = new(6, 8);
    private static readonly TimeSignature TwoFour = new(2, 4);
    private static readonly TimeSignature FiveFour = new(5, 4);
    private static readonly TimeSignature SevenEight = new(7, 8);

    /// <summary>
    /// All common presets, useful for cycling through in the UI.
    /// </summary>
    public static readonly TimeSignature[] CommonPresets =
    [
        CommonTime, Waltz, SixEight, TwoFour, FiveFour, SevenEight
    ];

    public readonly override string ToString() => $"{_numerator}/{_denominator}";

	private static bool IsPowerOfTwo(int value) => (value & (value - 1)) == 0;
}
