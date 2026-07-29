// Subdivisions are shown *relative to the beat*: splitting a beat into N gives
// a note value of (beat note value × N). So an eighth-note beat split in two is
// sixteenths — and a quarter note never appears as a subdivision of an eighth.
// The division count (what the engine actually schedules) is preserved across
// time-signature changes; only the displayed note value shifts with the beat.

export interface SubdivisionOption {
  /** Ticks per beat — what the engine schedules. */
  count: number;
  /** Label, used as the option's tooltip. */
  name: string;
  /** Single note glyph, for straight (non-triplet) divisions. */
  glyph?: string;
  /** Beam count for a beamed triplet group, for triplet divisions. */
  beams?: number;
}

// Unicode note glyphs by note value (4 = quarter, 8 = eighth, …). The range we
// can notate; divisions finer than a 128th note are dropped.
const NOTE_GLYPHS: Record<number, string> = {
  1: '\u{1D15D}', // whole
  2: '\u{1D15E}', // half
  4: '\u{1D15F}', // quarter
  8: '\u{1D160}', // eighth
  16: '\u{1D161}', // sixteenth
  32: '\u{1D162}', // thirty-second
  64: '\u{1D163}', // sixty-fourth
  128: '\u{1D164}', // hundred-twenty-eighth
};

const NOTE_PLURAL: Record<number, string> = {
  1: 'Whole notes',
  2: 'Half notes',
  4: 'Quarter notes',
  8: 'Eighths',
  16: 'Sixteenths',
  32: 'Thirty-seconds',
  64: 'Sixty-fourths',
  128: 'Hundred-twenty-eighths',
};

const NOTE_SINGULAR: Record<number, string> = {
  1: 'Whole-note',
  2: 'Half-note',
  4: 'Quarter-note',
  8: 'Eighth',
  16: 'Sixteenth',
  32: 'Thirty-second',
  64: 'Sixty-fourth',
  128: 'Hundred-twenty-eighth',
};

// The divisions we offer, before filtering to those the beat can represent.
const DIVISIONS: { count: number; triplet: boolean }[] = [
  { count: 1, triplet: false },
  { count: 2, triplet: false },
  { count: 3, triplet: true },
  { count: 4, triplet: false },
  { count: 6, triplet: true },
  { count: 8, triplet: false },
  { count: 12, triplet: true },
  { count: 16, triplet: false },
];

/** The note value a division produces over a beat of `beatNoteValue`. */
function dividedNoteValue(
  count: number,
  triplet: boolean,
  beatNoteValue: number,
): number {
  // Straight divisions are ×N; a triplet of N spans the next-finer level, so
  // 3→×2, 6→×4, 12→×8 (i.e. ×2N/3).
  return triplet ? beatNoteValue * ((2 * count) / 3) : beatNoteValue * count;
}

/**
 * The subdivision options available for a given beat note value, with glyphs
 * and names derived from the beat. Divisions finer than a 128th note are
 * dropped, since they can't be notated.
 */
export function subdivisionOptions(beatNoteValue: number): SubdivisionOption[] {
  const options: SubdivisionOption[] = [];
  for (const { count, triplet } of DIVISIONS) {
    const note = dividedNoteValue(count, triplet, beatNoteValue);
    if (NOTE_GLYPHS[note] === undefined) continue; // too fine to notate
    if (triplet) {
      options.push({
        count,
        name: `${NOTE_SINGULAR[note]} triplets`,
        // Eighth-triplets (note 8) have 1 beam, sixteenths 2, etc. Coarser
        // triplets (quarter/half) have none.
        beams: Math.max(0, Math.log2(note) - 2),
      });
    } else {
      options.push({
        count,
        name: count === 1 ? 'No subdivision' : NOTE_PLURAL[note],
        glyph: NOTE_GLYPHS[note],
      });
    }
  }
  return options;
}

/**
 * Clamp a subdivision count to one available for the given beat note value.
 * Keeps the count unchanged when it's still valid (so the division ratio is
 * preserved across beat changes); otherwise falls back to the nearest coarser
 * option — the closest still-notatable choice.
 */
export function clampSubdivision(count: number, beatNoteValue: number): number {
  const counts = subdivisionOptions(beatNoteValue).map((o) => o.count);
  if (counts.includes(count)) return count;
  const coarser = counts.filter((c) => c < count);
  return coarser.length > 0 ? Math.max(...coarser) : (counts[0] ?? 1);
}
