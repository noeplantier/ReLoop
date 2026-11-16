import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "../components/Icon";
import { LoopOrbit } from "../components/Brand";
import { AreaPicker } from "../components/AreaPicker";
import { MAX_TEXT_CHARS, type DataMode } from "../lib/config";
import { DEMO_REQUEST } from "../lib/presets";
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
  onDraftChange: (d: RequestDraft) => void;
  mode: DataMode;
  busy?: boolean;
  onModeChange: (m: DataMode) => void;
  onSubmit: (d: RequestDraft) => void;
  projects: ReloopProject[];
  canSave: boolean;
  onReopen: (id: string) => void;
  tab: "find" | "offer";
  onTab: (t: "find" | "offer") => void;
  offerPanel: ReactNode;
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function RequestScreen({ draft: d, onDraftChange, mode, busy, onModeChange, onSubmit, projects, canSave, onReopen, tab, onTab, offerPanel }: Props) {
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof RequestDraft>(k: K, v: RequestDraft[K]) => onDraftChange({ ...d, [k]: v });
  const datesInvalid = !!(d.startDate && d.endDate && d.endDate < d.startDate);
  const empty = d.text.trim().length === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (empty || datesInvalid || busy) return;
    onSubmit({ ...d, text: d.text.trim() });
  };

  return (
    <main className="view home">
      <section className="home__intro" aria-labelledby="hero-title">
        <LoopOrbit />
        <div>
          <h1 id="hero-title" className="display">Event equipment,<br /><span className="accent">kept in the loop.</span></h1>
          <p className="lede">Find an alternative to buying new — or share what you already have.</p>
        </div>

      </section>

      <section className="panel-main aura aura--strong" aria-label="Find or offer equipment">
        <div className="tabs2" role="tablist" aria-label="What do you want to do?">
          {(["find", "offer"] as const).map((t) => (
            <button key={t} id={`tab-${t}`} type="button" role="tab" aria-selected={tab === t} aria-controls={`pane-${t}`}
              tabIndex={tab === t ? 0 : -1} className={`tabs2__tab ${tab === t ? "is-on" : ""}`} onClick={() => onTab(t)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const n = t === "find" ? "offer" : "find";
                  onTab(n);
                  document.getElementById(`tab-${n}`)?.focus();
                }
              }}>
              <Icon name={t === "find" ? "search" : "plus"} size={18} /> {t === "find" ? "Find equipment" : "Offer equipment"}
            </button>
          ))}
        </div>

        {tab === "find" ? (
          <form id="pane-find" role="tabpanel" aria-labelledby="tab-find" className="pane" onSubmit={submit} noValidate>
            <div className="field">
              <div className="field__row">
                <label className="field__label" htmlFor="need">What do you need?</label>
                <details className="examples2">
                  <summary>Examples</summary>
                  <ul>
                    <li><button type="button" onClick={(e) => {
                      onDraftChange({ ...DEMO_REQUEST });
                      e.currentTarget.closest("details")?.removeAttribute("open");
                    }}>Antalya demo request</button></li>
                    {DEMO_EXAMPLES.filter((x) => x.id !== "main").map((x) => (
                      <li key={x.id}><button type="button" onClick={(e) => {
                        onDraftChange({ text: x.text, startDate: x.startDate, endDate: x.endDate, location: x.location });
                        e.currentTarget.closest("details")?.removeAttribute("open");
                      }}>{x.title}</button></li>
                    ))}
                  </ul>
                </details>
              </div>
              <textarea id="need" className="input input--area" rows={3} maxLength={MAX_TEXT_CHARS}
                placeholder="e.g. 50 chairs and 2 stage lights near Lara, Antalya"
                value={d.text} onChange={(e) => set("text", e.target.value)}
                aria-invalid={(touched && empty) || undefined} aria-describedby="need-hint" />
              <p id="need-hint" className={`field__note ${touched && empty ? "field__note--err" : ""}`}>
                {touched && empty ? "Describe what you need, in your own words." : "Plain words are fine — you’ll review everything next."}
              </p>
            </div>

            <fieldset className="field">
              <legend className="field__label"><Icon name="calendar" size={18} /> Event dates</legend>
              <div className="dates">
                <label className="date"><span className="date__cap">From</span>
                  <input type="date" className="input" value={d.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </label>
                <label className="date"><span className="date__cap">To</span>
                  <input type="date" className="input" value={d.endDate} min={d.startDate || undefined}
                    onChange={(e) => set("endDate", e.target.value)} aria-invalid={datesInvalid || undefined} />
                </label>
              </div>
              {datesInvalid && <p className="field__note field__note--err">The end date is before the start date.</p>}
            </fieldset>

            <AreaPicker value={d.location} onChange={(v) => set("location", v)} label="Event area" idHint="loc" />

            <button className="btn btn--primary btn--block" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? <><span className="spinner" aria-hidden="true" /> Reading your request…</> : <>Find reuse options <Icon name="arrow" /></>}
            </button>
          </form>
        ) : (
          <div id="pane-offer" role="tabpanel" aria-labelledby="tab-offer" className="pane">
            {offerPanel}
          </div>
        )}
      </section>

      <section className="home__aside" aria-label="Your saved work and data source">
        {projects.length > 0 && (
          <div className="resume2">
            <p className="eyebrow">Continue where you left off</p>
            <ul>
              {projects.slice(0, 2).map((p) => (
                <li key={p.id}>
                  <button type="button" className="resume2__item" onClick={() => onReopen(p.id)}>
                    <span className="resume2__name">{p.name}</span>
                    <span className="resume2__meta">{p.shortlist.length} shortlisted · {when(p.updated_at)}{p.mode === "demo" ? " · demo" : ""}</span>
                    <Icon name="next" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!canSave && <p className="field__note field__note--warn">This browser blocks saving (e.g. a private window): projects and offers will be lost when you close the page.</p>}

        <div className="mode" role="radiogroup" aria-label="Inventory">
          {(["live", "demo"] as DataMode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={`mode__opt ${mode === m ? "is-on" : ""}`}
              onClick={() => onModeChange(m)}>
              {m === "live" ? "Live inventory" : "Demo (recorded)"}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
