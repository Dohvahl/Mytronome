/**
 * The tempo-ramp glyph: a curved ramp thickening as it climbs, ending in a
 * swept-back arrowhead that leans into the curve.
 *
 * One closed path, no transform. The three straight segments near the end are
 * the arrowhead's barbs and tip, with the rotation that gives them their lean
 * baked into the coordinates — so the arm's top edge doubles as the head's back
 * and the two can't drift apart. `fill="currentColor"` lets the button's
 * [data-ramp-active] accent rule tint it with no extra CSS.
 *
 * The coordinate space is the one the shape was drawn in rather than a
 * normalised 24x24 grid: SVG scales it to whatever size the button asks for,
 * and keeping it avoids re-deriving every point.
 */
export function RampIcon() {
  return (
    <svg
      className="ramp-icon"
      viewBox="3.6 30 470 470"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M237.928 197.103C205.736 384.694 173.837 413.96 22.388 486.392C159.936 452.736 295.289 420.105 358.648 198.859L454.819 226.459L309.933 44.332L139.217 202.5Z" />
    </svg>
  );
}
