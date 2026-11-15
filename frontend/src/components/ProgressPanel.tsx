import { Icon } from "./Icon";
import type { ProgressOut } from "../lib/api";

const EVIDENCE_TEXT: Record<string, string> = {
  demo: "Demo",
  user_reported: "Your actions in this app",
  verified: "Verified",
};

/** "My ReLoop" progress. Pure display of what the server returned: the browser never computes points. */
export function ProgressPanel({ progress, loading, unavailable }: {
  progress: ProgressOut | null;
  loading: boolean;
  unavailable: string | null;
}) {
  return (
    <section className="panel progress" aria-labelledby="prog-h">
      <div className="panel__row">
        <h2 id="prog-h" className="panel__h"><Icon name="sparkle" /> My ReLoop progress</h2>
        {progress && (
          <span className="prog-points" aria-label={`${progress.points.earned} of ${progress.points.possible} progress points`}>
            {progress.points.earned}/{progress.points.possible} pts
          </span>
        )}
      </div>

      {loading && !progress && <p className="small-note">Checking your progress…</p>}
      {unavailable && !progress && <p className="small-note">{unavailable}</p>}

      {progress && (
        <>
          <div className="prog-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((100 * progress.points.earned) / Math.max(progress.points.possible, 1))}%` }} />
          </div>
          <p className="small-note">{progress.points.note}</p>

          <ul className="milestones">
            {progress.milestones.map((m) => (
              <li key={m.id} className={m.status === "complete" ? "is-done" : ""}>
                <span className="ms__icon" aria-hidden="true">
                  <Icon name={m.status === "complete" ? "check" : "plus"} size={16} />
                </span>
                <div className="ms__text">
                  <p className="ms__title">
                    {m.title} <span className="ms__pts">+{m.points}</span>
                    <span className="sr-only">{m.status === "complete" ? " (done)" : " (not yet)"}</span>
                  </p>
                  <p className="ms__rule">{m.eligibility}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="small-note">
            Evidence: {EVIDENCE_TEXT[progress.evidence] ?? progress.evidence}. Nothing here is independently verified.
            Rules {progress.rules_version}, same result every time for the same project.
          </p>

          <h3 className="prog-sub">Rewards</h3>
          <div className="rewards">
            {progress.rewards.map((r) => (
              <div key={r.id} className="reward">
                <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
                  <circle cx="22" cy="22" r="19" fill="none" stroke="#0ab567" strokeWidth="4" />
                  <circle cx="22" cy="22" r="13" fill="none" stroke="#5ef0b2" strokeWidth="3" strokeDasharray="60 22" />
                </svg>
                <div>
                  <p className="reward__title">{r.title}</p>
                  <p className="reward__note">{r.status === "concept" ? "Concept — not redeemable" : r.status}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="small-note">{progress.rewards[0]?.note}</p>
        </>
      )}
    </section>
  );
}
