interface Props {
  /** Number of beats in the measure (one dot each). */
  beats: number;
  /** Zero-based index of the currently sounding beat, or -1 when stopped. */
  currentBeat: number;
}

/** A row of dots — one per beat. Beat 0 is the accent; the live beat lights up. */
export function BeatIndicator({ beats, currentBeat }: Props) {
  return (
    <div className="beat-indicator">
      {Array.from({ length: beats }, (_, i) => {
        const classNames = [
          'beat-dot',
          i === 0 ? 'accent' : '',
          i === currentBeat ? 'active' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return <span key={i} className={classNames} />;
      })}
    </div>
  );
}
