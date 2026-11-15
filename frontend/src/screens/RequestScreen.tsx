import { useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { MAX_TEXT_CHARS, type DataMode } from "../lib/config";
import { DEMO_REQUEST, PRESETS } from "../lib/presets";
import { DEMO_EXAMPLES } from "../demo/demo";
import type { ReloopProject } from "../lib/project";

export interface RequestDraft {
  text: string;
  startDate: string;
  endDate: string;
  location: string; // preset id, "" = not chosen
}

interface Props {
  draft: RequestDraft;
  mode: DataMode;
  busy?: boolean;
  error?: string | null;
  onModeChange: (m: DataMode) => void;
  onSubmit: (d: RequestDraft) => void;
  projects: ReloopProject[];
  canSave: boolean;
  onReopen: (id: string) => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function RequestScreen({ draft, mode, busy, error, onModeChange, onSubmit, projects, canSave, onReopen }: Props) {
  const [d, setD] = useState<RequestDraft>(draft);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof RequestDraft>(k: K, v: RequestDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const datesInvalid = !!(d.startDate && d.endDate && d.endDate < d.startDate);
  const empty = d.text.trim().length === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (empty || datesInvalid || busy) return;
    onSubmit({ ...d, text: d.text.trim() });
  };

  return (
    <main className="request">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__loops" aria-hidden="true" />
        <h1 id="hero-title" className="hero__title">
          Find equipment.
          <br />
          <span className="hero__accent">Reuse locally.</span>
        </h1>
        <p className="hero__sub">Give events a lighter footprint together.</p>
        <div className="hero__rule" aria-hidden="true">
          <Icon name="leaf" size={22} />
          <span />
        </div>

        {projects.length > 0 && (
          <div className="resume" aria-labelledby="resume-h">
            <h2 id="resume-h" className="resume__h">Continue where you left off</h2>
            <ul>
              {projects.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <button type="button" className="resume__item" onClick={() => onReopen(p.id)}>
                    <span className="resume__name">{p.name}</span>
                    <span className="resume__meta">
                      {p.shortlist.length} in shortlist · updated {when(p.updated_at)}{p.mode === "demo" ? " · demo" : ""}
                    </span>
                    <Icon name="arrow" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="resume__note">Saved in this browser only.</p>
          </div>
        )}
        {!canSave && (
          <p className="resume__note">
            This browser blocks saving (for example a private window), so projects can’t be kept after you close the page.
          </p>
        )}
        {canSave && projects.length === 0 && (
          <details className="resume__help">
            <summary>Looking for a saved project?</summary>
            <p>
              No saved project found in this browser. Projects are saved only in the browser where you created them, and
              clearing browser data deletes them. Start a new request below; the review screen lets you refill it quickly.
            </p>
          </details>
        )}
      </section>

      <form className="card-light" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="need">
            <Icon name="chair" /> What do you need?
          </label>
          <textarea
            id="need"
            className="input input--area"
            rows={3}
            maxLength={MAX_TEXT_CHARS}
            placeholder="e.g. 50 chairs and 2 stage lights near Lara, Antalya"
            value={d.text}
            onChange={(e) => set("text", e.target.value)}
            aria-invalid={touched && empty}
            aria-describedby="need-hint"
          />
          <div id="need-hint" className="field__hint">
            {touched && empty && <span className="field__error">Describe what you need, in your own words.</span>}
            <div className="examples">
              <button type="button" className="chip" onClick={() => setD({ ...DEMO_REQUEST })}>
                <Icon name="sparkle" size={16} /> Try the Antalya demo request
              </button>
              <details className="examples__more">
                <summary>More examples</summary>
                <ul>
                  {DEMO_EXAMPLES.filter((x) => x.id !== "main").map((x) => (
                    <li key={x.id}>
                      <button type="button" className="example" onClick={(e) => {
                        setD({ text: x.text, startDate: x.startDate, endDate: x.endDate, location: x.location });
                        (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                      }}>
                        {x.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </div>

        <fieldset className="field">
          <legend className="field__label">
            <Icon name="calendar" /> Event dates
          </legend>
          <div className="dates">
            <label className="date">
              <span className="date__cap">From</span>
              <input
                type="date"
                className="input"
                value={d.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </label>
            <label className="date">
              <span className="date__cap">To</span>
              <input
                type="date"
                className="input"
                value={d.endDate}
                min={d.startDate || undefined}
                onChange={(e) => set("endDate", e.target.value)}
                aria-invalid={datesInvalid}
              />
            </label>
          </div>
          {datesInvalid && <p className="field__error">The end date is before the start date.</p>}
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor="loc">
            <Icon name="pin" /> Location
          </label>
          <div className="select">
            <select id="loc" className="input" value={d.location} onChange={(e) => set("location", e.target.value)}>
              <option value="">Choose a demo location…</option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={18} />
          </div>
          <p className="field__note">Demo locations only. Distances are approximate.</p>
        </div>

        <button className="btn btn--primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Reading your request…
            </>
          ) : (
            <>
              <Icon name="search" /> Find reuse options <Icon name="arrow" />
            </>
          )}
        </button>

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <div className="mode" role="radiogroup" aria-label="Data source">
          <span className="mode__label">Data</span>
          {(["live", "demo"] as DataMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={`mode__opt ${mode === m ? "is-on" : ""}`}
              onClick={() => onModeChange(m)}
            >
              {m === "live" ? "Live" : "Demo (recorded examples)"}
            </button>
          ))}
        </div>
      </form>

      <footer className="foot">
        <Icon name="leaf" size={18} />
        A more circular event economy
      </footer>
    </main>
  );
}
