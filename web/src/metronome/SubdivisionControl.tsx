import { useEffect, useRef, useState } from 'react';
import { useWheelAdjust } from './hooks';
import { subdivisionOptions, type SubdivisionOption } from './subdivisions';

interface Props {
  value: number;
  onChange: (value: number) => void;
  /** The beat's note value (denominator); subdivision glyphs are relative to it. */
  beatNoteValue: number;
}

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

function Glyph({ option }: { option: SubdivisionOption }) {
  if (option.glyph) return <span className="sub-note">{option.glyph}</span>;
  return <TripletGlyph beams={option.beams ?? 0} />;
}

export function SubdivisionControl({ value, onChange, beatNoteValue }: Props) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Which subdivisions are offered depends on the beat note value.
  const options = subdivisionOptions(beatNoteValue);
  const current = options.find((o) => o.count === value) ?? options[0];

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
    const currentIndex = options.findIndex((o) => o.count === value);
    const nextIndex = currentIndex - dir;
    if (nextIndex >= 0 && nextIndex < options.length) {
      onChange(options[nextIndex].count);
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
        <Glyph option={current} />
        <span className="subdivision-chevron" aria-hidden="true">
          &#9662;
        </span>
      </button>
      {open && (
        <ul className="subdivision-menu" role="listbox">
          {options.map((o) => (
            <li key={o.count} role="option" aria-selected={o.count === value}>
              <button
                type="button"
                className={o.count === value ? 'active' : ''}
                onClick={() => {
                  onChange(o.count);
                  setOpen(false);
                }}
                title={o.name}
              >
                <Glyph option={o} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
