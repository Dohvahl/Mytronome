import { useEffect, useRef, useState } from 'react';
import { useWheelAdjust } from './hooks';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

interface Sub {
  value: number;
  name: string;
  glyph?: string; // single-note Unicode glyph (non-triplets)
  beams?: number; // beamed triplet group with this many beams (triplets)
}

const SUBDIVISIONS: Sub[] = [
  { value: 1, name: 'No subdivision', glyph: '\u{1D15F}' },
  { value: 2, name: 'Eighths', glyph: '\u{1D160}' },
  { value: 3, name: 'Eighth triplets', beams: 1 },
  { value: 4, name: 'Sixteenths', glyph: '\u{1D161}' },
  { value: 6, name: 'Sixteenth triplets', beams: 2 },
  { value: 8, name: 'Thirty-seconds', glyph: '\u{1D162}' },
  { value: 12, name: 'Thirty-second triplets', beams: 3 },
  { value: 16, name: 'Sixty-fourths', glyph: '\u{1D163}' },
];

function TripletGlyph({ beams }: { beams: number }) {
  const noteX = [5, 14, 23];
  const headCy = 23;
  const stemTop = 9;
  const stemXs = noteX.map((x) => x + 2.7);
  return (
    <svg className="triplet-glyph" viewBox="0 0 30 28" aria-hidden="true">
      {noteX.map((x) => (
        <ellipse
          key={`h${x}`}
          cx={x}
          cy={headCy}
          rx={3.2}
          ry={2.3}
          transform={`rotate(-18 ${x} ${headCy})`}
          fill="currentColor"
        />
      ))}
      {stemXs.map((x) => (
        <line
          key={`s${x}`}
          x1={x}
          y1={headCy}
          x2={x}
          y2={stemTop}
          stroke="currentColor"
          strokeWidth={1.1}
        />
      ))}
      {Array.from({ length: beams }, (_, b) => (
        <rect
          key={`b${b}`}
          x={stemXs[0] - 0.6}
          y={stemTop + b * 2.8}
          width={stemXs[2] - stemXs[0] + 1.2}
          height={1.8}
          fill="currentColor"
        />
      ))}
      <text
        x={stemXs[1]}
        y={6}
        textAnchor="middle"
        fontSize={7.5}
        fontStyle="italic"
        fill="currentColor"
      >
        3
      </text>
    </svg>
  );
}

function Glyph({ sub }: { sub: Sub }) {
  if (sub.glyph) return <span className="sub-note">{sub.glyph}</span>;
  return <TripletGlyph beams={sub.beams ?? 1} />;
}

export function SubdivisionControl({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const current = SUBDIVISIONS.find((s) => s.value === value) ?? SUBDIVISIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const subdWheelRef = useWheelAdjust<HTMLButtonElement>((dir) => {
	const currentIndex = SUBDIVISIONS.findIndex((s) => s.value === value);
	const nextIndex = currentIndex - dir;
	if (nextIndex >= 0 && nextIndex < SUBDIVISIONS.length) {
	  onChange(SUBDIVISIONS[nextIndex].value);
	}
  });

  return (
    <div className="subdivision-picker" ref={pickerRef}>
        <button
          type="button"
          className="subdivision-trigger"
          ref={subdWheelRef}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Subdivision: ${current.name}`}
        >
          <Glyph sub={current} />
          <span className="subdivision-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <ul className="subdivision-menu" role="listbox">
            {SUBDIVISIONS.map((s) => (
              <li key={s.value} role="option" aria-selected={s.value === value}>
                <button
                  type="button"
                  className={s.value === value ? 'active' : ''}
                  onClick={() => {
                    onChange(s.value);
                    setOpen(false);
                  }}
                  title={s.name}
                >
                  <Glyph sub={s} />
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
