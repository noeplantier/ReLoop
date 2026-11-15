const LABELS = ["Request", "Review", "Results", "Shortlist"];

export function Steps({ current }: { current: number }) {
  return (
    <ol className="steps" aria-label="Progress">
      {LABELS.map((l, i) => (
        <li key={l} className={i < current ? "is-done" : i === current ? "is-current" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="steps__dot" aria-hidden="true">
            {i < current ? "✓" : ""}
          </span>
          <span className="steps__label">{l}</span>
        </li>
      ))}
    </ol>
  );
}
