/**
 * App wordmark at the top of the screen: the metronome mark + "Mytronome".
 * Besides branding, this is the visible app name Google's OAuth brand
 * verification looks for on the home page (it must match the consent-screen
 * name). The frame uses currentColor so it adapts to light/dark; the pendulum
 * keeps its fixed brass brand color.
 */
export function BrandHeader() {
  return (
    <header className="app-brand">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <line
          x1="22"
          y1="80"
          x2="29"
          y2="24"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <line
          x1="78"
          y1="80"
          x2="71"
          y2="24"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="79"
          x2="57"
          y2="25"
          stroke="#b8935a"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <rect
          x="46.5"
          y="45"
          width="15"
          height="8"
          rx="2.5"
          fill="#b8935a"
          transform="rotate(7 54 49)"
        />
        <circle cx="50" cy="79" r="4" fill="currentColor" />
      </svg>
      <span>Mytronome</span>
    </header>
  );
}
