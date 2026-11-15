import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Steps } from "../components/Steps";
import { api, ApiError, type ProgressOut, type ShortlistCheckItem } from "../lib/api";
import { ProgressPanel } from "../components/ProgressPanel";
import { CATEGORIES } from "../lib/types";
import { presetById } from "../lib/presets";
import { estimatedOpportunity, type StoredProject } from "../lib/project";
import { fmt } from "../demo/demo";

interface Props {
  stored: StoredProject;
  saved: boolean; // false when the browser refused to store it
  autoCheck: boolean; // run the availability re-check on open (reopened project)
  onBack: () => void;
  onEditRequest: () => void;
  onRemove: (itemId: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onShowMethod: () => void;
}

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "done"; at: string; items: Record<string, ShortlistCheckItem>; source: string }
  | { state: "unavailable"; reason: string };

const STATUS_TEXT: Record<ShortlistCheckItem["status"], string> = {
  available: "Still available for your dates",
  partial: "Only partly available now",
  unavailable: "No longer available for your dates",
  unknown_item: "This item is no longer listed",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function ShortlistScreen({ stored, saved, autoCheck, onBack, onEditRequest, onRemove, onRename, onDelete, onShowMethod }: Props) {
  const p = stored.project;
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function recheck() {
    if (p.mode === "demo") {
      setCheck({ state: "unavailable", reason: "Not re-checked: demo mode replays recorded results." });
      return;
    }
    if (!p.shortlist.length) return;
    setCheck({ state: "checking" });
    try {
      const out = await api.shortlistCheck(p.brief, p.shortlist.map(({ need_category, item_id, quantity }) => ({ need_category, item_id, quantity })));
      setCheck({ state: "done", at: new Date().toISOString(), source: out.inventory_source,
                 items: Object.fromEntries(out.items.map((i) => [i.item_id, i])) });
    } catch (e) {
      const notThere = e instanceof ApiError && e.status === 404;
      setCheck({ state: "unavailable", reason: notThere
        ? "Availability re-check is not available on this server yet."
        : `Could not re-check availability: ${e instanceof ApiError ? e.message : "unexpected error"}` });
    }
  }

  useEffect(() => {
    if (autoCheck) recheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  // Progress: evaluated by the server from the project (deterministic). Re-run when the substance changes
  // (not on every rename keystroke), debounced.
  const [progress, setProgress] = useState<ProgressOut | null>(null);
  const [progLoading, setProgLoading] = useState(false);
  const [progUnavailable, setProgUnavailable] = useState<string | null>(null);
  const progKey = JSON.stringify([p.brief, p.shortlist.map((e) => [e.item_id, e.quantity]), p.events.length, p.mode]);
  useEffect(() => {
    if (p.mode === "demo") {
      setProgress(null);
      setProgUnavailable("Progress is evaluated by the live server, so it is not shown in demo mode.");
      return;
    }
    let cancelled = false;
    setProgLoading(true);
    const t = setTimeout(async () => {
      try {
        const out = await api.progress(p);
        if (cancelled) return;
        setProgress(out);
        setProgUnavailable(null);
        // The evaluation includes a fresh availability re-check of the shortlist.
        if (out.shortlist?.length) {
          setCheck({ state: "done", at: new Date().toISOString(), source: out.inventory_source ?? "",
                     items: Object.fromEntries(out.shortlist.map((i) => [i.item_id, i])) });
        }
      } catch (e) {
        if (cancelled) return;
        setProgress(null);
        setProgUnavailable(e instanceof ApiError && e.status === 404
          ? "Progress is not available on this server yet."
          : `Could not load progress: ${e instanceof ApiError ? e.message : "unexpected error"}`);
      } finally {
        if (!cancelled) setProgLoading(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progKey]);

  const local = estimatedOpportunity(stored);
  const srv = progress?.estimated_opportunity;
  // Prefer the server's figure (recomputed from current inventory); fall back to the engine numbers we kept.
  const opp = srv && srv.kgco2e_upper != null
    ? { lo: srv.kgco2e_conservative ?? srv.kgco2e_upper, hi: srv.kgco2e_upper, illustrative: srv.status !== "sourced" }
    : local;
  const loc = presetById(p.brief.location.preset_id);
  const coverage = p.brief.needs.map((n) => {
    const got = p.shortlist.filter((e) => e.need_category === n.category).reduce((a, e) => a + e.quantity, 0);
    return { ...n, got };
  });

  // Next steps: same order of rules as the backend contract (B3), computed from what is on screen.
  const next: string[] = [];
  if (check.state === "done") {
    for (const e of p.shortlist) {
      const c = check.items[e.item_id];
      if (c && c.status !== "available") next.push(`Replace ${e.snapshot.name}: availability changed.`);
    }
  }
  for (const c of coverage) {
    if (c.got < c.quantity) next.push(`Choose an option for ${c.label} (${c.quantity - c.got} still needed).`);
  }
  if (!next.length) next.push("Your shortlist is ready. Contacting suppliers is not part of this prototype.");
  // When the server evaluated the project, its next step is the authoritative first item.
  if (progress?.next_step && !next.includes(progress.next_step.text)) next.splice(0, next.length, progress.next_step.text);

  return (
    <main className="page page--wide">
      <div className="topbar">
        <button className="link-back" onClick={onBack}>
          <Icon name="back" size={18} /> Back
        </button>
        <span className={`src ${saved ? "" : "src--warn"}`}>{saved ? "Saved in this browser" : "Not saved: storage blocked"}</span>
      </div>
      <Steps current={3} />

      <label className="name-field">
        <span className="date__cap">Project name</span>
        <input className="input input--dark name-input" maxLength={80} value={p.name}
          onChange={(e) => onRename(e.target.value)} aria-label="Project name" />
      </label>
      <p className="page__meta">
        <Icon name="pin" size={16} /> {loc?.name ?? "Location"} · {day(p.brief.start_date + "T12:00:00")}–{day(p.brief.end_date + "T12:00:00")}
        {p.mode === "demo" && <span className="src src--browser_demo">Demo</span>}
      </p>

      <p className="notice notice--info">
        <Icon name="info" size={16} />
        <span>
          A shortlist is not a reservation: nothing is booked and stock is not held for you.{" "}
          {saved
            ? "Saved on this device and browser only; clearing browser data deletes it."
            : "This browser does not allow saving, so the project will be lost when you close the page."}
        </span>
      </p>

      <section className="panel" aria-labelledby="cov-h">
        <h2 id="cov-h" className="panel__h"><Icon name="chair" /> Your needs</h2>
        <ul className="plain">
          {coverage.map((c) => (
            <li key={c.category}>
              {c.quantity} {c.label}:{" "}
              <b className={c.got >= c.quantity ? "ok" : "warn"}>
                {c.got >= c.quantity ? "covered in your shortlist" : c.got ? `${c.got} of ${c.quantity} shortlisted` : "nothing shortlisted yet"}
              </b>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="sl-h">
        <div className="panel__row">
          <h2 id="sl-h" className="panel__h"><Icon name="check" /> Shortlist ({p.shortlist.length})</h2>
          {p.shortlist.length > 0 && p.mode === "live" && (
            <button className="btn btn--small btn--ghost" onClick={recheck} disabled={check.state === "checking"}>
              {check.state === "checking" ? "Re-checking…" : "Re-check availability"}
            </button>
          )}
        </div>
        {check.state === "done" && (
          <p className="small-note">Availability re-checked at {time(check.at)} (not guaranteed).</p>
        )}
        {check.state === "unavailable" && <p className="small-note">{check.reason}</p>}
        {p.shortlist.length === 0 && (
          <p className="panel__empty">Nothing shortlisted yet. Add options from the results with “Add to shortlist”.</p>
        )}
        <ul className="sl">
          {p.shortlist.map((e) => {
            const c = check.state === "done" ? check.items[e.item_id] : undefined;
            const cat = CATEGORIES.find((x) => x.slug === e.need_category)?.name ?? e.need_category;
            return (
              <li key={e.item_id} className="sl__item">
                <div className="sl__main">
                  <p className="sl__cat">{cat} · {e.quantity} units</p>
                  <p className="sl__name">{e.snapshot.name}</p>
                  <p className="sl__sup">{e.snapshot.supplier_name} · ~{e.snapshot.distance_km} km
                    {e.snapshot.estimated_cost_try != null && <> · est. TRY {Math.round(e.snapshot.estimated_cost_try).toLocaleString("en-US")}</>}
                  </p>
                  {c && (
                    <p className={`sl__status ${c.status === "available" ? "ok" : "warn"}`}>
                      <Icon name={c.status === "available" ? "check" : "warn"} size={16} /> {STATUS_TEXT[c.status]}
                      {c.status === "partial" && c.missing_quantity ? ` (${c.missing_quantity} missing)` : ""}
                    </p>
                  )}
                  <p className="sl__seen">Added {day(e.added_at)}, {time(e.added_at)}</p>
                </div>
                <button className="need__rm" aria-label={`Remove ${e.snapshot.name} from shortlist`} onClick={() => onRemove(e.item_id)}>
                  <Icon name="x" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {opp && (
        <section className="panel" aria-labelledby="opp-h">
          <h2 id="opp-h" className="panel__h"><Icon name="leaf" /> Estimated opportunity</h2>
          <p>
            {fmt(opp.lo)}–{fmt(opp.hi)} kg CO2e{opp.illustrative ? " (illustrative)" : ""} if these items are reused instead of
            bought new, each item counted once.
          </p>
          <p className="small-note">An estimate for this shortlist, not saved, measured or verified carbon.</p>
          <button className="link-inline" onClick={onShowMethod}>How we calculate →</button>
        </section>
      )}

      <section className="panel" aria-labelledby="next-h">
        <h2 id="next-h" className="panel__h"><Icon name="arrow" /> Next steps</h2>
        <ul className="plain">
          {next.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </section>

      <ProgressPanel progress={progress} loading={progLoading} unavailable={progUnavailable} />

      <div className="actions">
        <button className="btn btn--outline" onClick={onEditRequest}>Edit request</button>
        {!confirmDelete ? (
          <button className="link-inline danger" onClick={() => setConfirmDelete(true)}>Delete this project</button>
        ) : (
          <div className="confirm">
            <span>Delete “{p.name}” from this browser? This cannot be undone.</span>
            <button className="btn btn--small" onClick={onDelete}>Delete</button>
            <button className="btn btn--small btn--ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>
    </main>
  );
}
