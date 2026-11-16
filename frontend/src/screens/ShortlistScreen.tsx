import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Steps } from "../components/Steps";
import { EquipmentArt } from "../components/EquipmentArt";
import { api, ApiError, type ProgressOut, type ShortlistCheckItem } from "../lib/api";
import { CATEGORIES } from "../lib/types";
import { presetById } from "../lib/presets";
import { estimatedOpportunity, type StoredProject } from "../lib/project";
import { progressData, useProgress } from "../lib/useProgress";
import { fmt } from "../demo/demo";
import type { Offer } from "../lib/local";

interface Props {
  stored: StoredProject;
  saved: boolean; // false when the browser refused to store it
  autoCheck: boolean; // run the availability re-check on open (reopened project)
  onBack: () => void;
  onFindMore: () => void;
  onEditRequest: () => void;
  onRemove: (itemId: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onShowMethod: () => void;
  onProgress: (out: ProgressOut) => void;
  onOpenHub: () => void;
  offers: Offer[]; // server-checked offers, sent with the project for progress
}

type Check =
  | { state: "idle" }
  | { state: "checking"; prev: Check | null }
  | { state: "done"; at: string; items: Record<string, ShortlistCheckItem> }
  | { state: "unavailable"; reason: string; prev: Check | null };

const STATUS_TEXT: Record<ShortlistCheckItem["status"], string> = {
  available: "Still available for your dates",
  partial: "Only partly available now",
  unavailable: "No longer available for your dates",
  unknown_item: "No longer listed",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function ShortlistScreen({ stored, saved, autoCheck, onBack, onFindMore, onEditRequest, onRemove, onRename, onDelete, onShowMethod, onProgress, onOpenHub, offers }: Props) {
  const p = stored.project;
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function recheck() {
    if (p.mode === "demo") {
      setCheck({ state: "unavailable", prev: null, reason: "Not re-checked: demo mode replays recorded results." });
      return;
    }
    if (!p.shortlist.length) return;
    // A failed re-check keeps the previous result and never touches the saved shortlist.
    setCheck((c) => ({ state: "checking", prev: c }));
    try {
      const out = await api.shortlistCheck(p.brief, p.shortlist.map(({ need_category, item_id, quantity }) => ({ need_category, item_id, quantity })));
      setCheck({ state: "done", at: new Date().toISOString(), items: Object.fromEntries(out.items.map((i) => [i.item_id, i])) });
    } catch (e) {
      const reason = e instanceof ApiError && e.status === 404
        ? "Availability re-check isn’t available on this server yet."
        : `Couldn’t re-check availability: ${e instanceof ApiError ? e.message : "unexpected error"} Your shortlist is unchanged.`;
      setCheck((c) => ({ state: "unavailable", reason, prev: c.state === "checking" ? c.prev : c }));
    }
  }

  useEffect(() => {
    if (autoCheck) recheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const prog = useProgress(p, (out) => {
    onProgress(out);
    // The evaluation includes a fresh availability re-check of the shortlist (live projects only).
    if (p.mode === "live" && out.shortlist?.length) {
      setCheck({ state: "done", at: new Date().toISOString(), items: Object.fromEntries(out.shortlist.map((i) => [i.item_id, i])) });
    }
  }, offers);
  const progress = progressData(prog);

  const lastDone = check.state === "done" ? check
    : (check.state === "checking" || check.state === "unavailable") && check.prev?.state === "done" ? check.prev : null;
  const local = estimatedOpportunity(stored);
  const srv = progress?.estimated_opportunity;
  const opp = srv && srv.kgco2e_upper != null
    ? { lo: srv.kgco2e_conservative ?? srv.kgco2e_upper, hi: srv.kgco2e_upper, illustrative: srv.status !== "sourced" }
    : local;
  const loc = presetById(p.brief.location.preset_id);
  const coverage = p.brief.needs.map((n) => ({
    ...n, got: p.shortlist.filter((e) => e.need_category === n.category).reduce((a, e) => a + e.quantity, 0),
  }));
  const gaps = coverage.filter((c) => c.got < c.quantity);
  const problems = lastDone ? p.shortlist.filter((e) => lastDone.items[e.item_id] && lastDone.items[e.item_id].status !== "available") : [];

  const nextText = progress?.next_step.text
    ?? (problems.length ? `Replace ${problems[0].snapshot.name}: availability changed.`
      : gaps.length ? `Choose an option for ${gaps[0].label} (${gaps[0].quantity - gaps[0].got} more needed).`
        : "Your shortlist is ready. Contacting suppliers isn’t part of this prototype; nothing is reserved.");
  const needsMore = !p.shortlist.length || gaps.length > 0 || problems.length > 0;
  const starter = progress?.rewards.find((r) => r.id === "reuse_starter");
  const [copied, setCopied] = useState(false);
  async function copySummary() {
    const lines = [
      `Equipment request: ${p.brief.needs.map((n) => `${n.quantity} ${n.label}`).join(", ")}`,
      `Dates: ${day(p.brief.start_date + "T12:00:00")} – ${day(p.brief.end_date + "T12:00:00")} · Area: ${loc?.name ?? ""}`,
      "Shortlisted options (to confirm availability, price, delivery and deposit with each supplier):",
      ...p.shortlist.map((e) => `- ${e.quantity} × ${e.snapshot.name} — ${e.snapshot.supplier_name}`),
      "Prepared with ReLoop (prototype). Nothing has been reserved.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
    } catch {
      window.prompt("Copy this summary:", lines);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <main className="view view--project">
      <div className="view__head">
        <div className="topbar">
          <button className="link-back" onClick={onBack}><Icon name="back" size={18} /> Back</button>
          <span className={`src ${saved ? "" : "src--warn"}`}>{saved ? "Saved in this browser" : "Not saved: storage blocked"}</span>
        </div>
        <Steps current={3} />
        <input className="title-input" maxLength={80} value={p.name} onChange={(e) => onRename(e.target.value)} aria-label="Project name" />
        <p className="meta"><Icon name="pin" size={16} /> {loc?.name ?? "Area"} · {day(p.brief.start_date + "T12:00:00")}–{day(p.brief.end_date + "T12:00:00")}
          {p.mode === "demo" && <span className="src src--browser_demo">Demo</span>}</p>
      </div>

      <div className="view__body project-grid">
        <section className="card" aria-labelledby="sl-h">
          <div className="card__row">
            <h2 id="sl-h" className="h2">Shortlist <span className="count">{p.shortlist.length}</span></h2>
            {p.shortlist.length > 0 && p.mode === "live" && (
              <button className="btn btn--small btn--ghost" onClick={recheck} disabled={check.state === "checking"}>
                {check.state === "checking" ? "Re-checking…" : "Re-check availability"}
              </button>
            )}
          </div>
          {lastDone && <p className="fine">Re-checked at {time(lastDone.at)} · not a reservation, not guaranteed.</p>}
          {check.state === "unavailable" && <p className="field__note field__note--warn" role="status">{check.reason}</p>}
          {p.shortlist.length === 0 && <p className="empty2">Nothing shortlisted yet. Partial matches count — add what helps.</p>}
          <ul className="sl2">
            {p.shortlist.map((e) => {
              const c = lastDone?.items[e.item_id];
              const cat = CATEGORIES.find((x) => x.slug === e.need_category)?.name ?? e.need_category;
              return (
                <li key={e.item_id} className="sl2__item">
                  <div className="sl2__art"><EquipmentArt category={e.need_category} label={false} /></div>
                  <div className="sl2__main">
                    <p className="sl2__name">{e.snapshot.name}</p>
                    <p className="fine">{cat} · {e.quantity} units · {e.snapshot.supplier_name} (fictional) · ~{e.snapshot.distance_km} km
                      {e.snapshot.estimated_cost_try != null && <> · est. TRY {Math.round(e.snapshot.estimated_cost_try).toLocaleString("en-US")}</>}</p>
                    {c && (
                      <p className={`status ${c.status === "available" ? "is-ok" : "is-warn"}`}>
                        <Icon name={c.status === "available" ? "check" : "warn"} size={14} /> {STATUS_TEXT[c.status]}
                        {c.status === "partial" && c.missing_quantity ? ` (${c.missing_quantity} missing)` : ""}
                      </p>
                    )}
                  </div>
                  <button className="icon-btn" aria-label={`Remove ${e.snapshot.name} from shortlist`} onClick={() => onRemove(e.item_id)}>
                    <Icon name="x" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="stack">
          <section className="card card--next" aria-labelledby="next-h">
            <h2 id="next-h" className="h3">Next useful step</h2>
            <p>{nextText}</p>
            <ul className="cov">
              {coverage.map((c) => (
                <li key={c.category} className={c.got >= c.quantity ? "is-ok" : "is-warn"}>
                  <span>{c.quantity} {c.label}</span>
                  <b>{c.got >= c.quantity ? "Covered" : `${c.got}/${c.quantity}`}</b>
                </li>
              ))}
            </ul>
            {needsMore ? (
              <button className="btn btn--block btn--primary" onClick={onFindMore}>
                <Icon name="search" size={18} /> Find more options
              </button>
            ) : (
              <>
                <button className="btn btn--block btn--primary" onClick={copySummary}>
                  <Icon name={copied ? "check" : "copy"} size={18} /> {copied ? "Summary copied" : "Copy summary for suppliers"}
                </button>
                <p className="fine">Paste it into your own message to each supplier. ReLoop doesn’t contact anyone or reserve anything.</p>
                <button className="btn btn--block btn--ghost btn--small" onClick={onFindMore}>Browse options again</button>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="pr-h">
            <div className="card__row">
              <h2 id="pr-h" className="h3">Progress</h2>
              {progress && <span className="count">{progress.points.earned}/{progress.points.possible} pts</span>}
            </div>
            {prog.state === "loading" && !progress && <p className="fine">Checking your progress…</p>}
            {prog.state === "unavailable" && <p className="fine">{prog.reason}</p>}
            {progress && (
              <>
                <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round((100 * progress.points.earned) / Math.max(progress.points.possible, 1))}%` }} /></div>
                <p className="fine">{progress.milestones.filter((m) => m.status === "complete").length} of {progress.milestones.length} reuse steps · evaluated by the server</p>
              </>
            )}
            <button className={`btn btn--block ${!needsMore && starter?.status === "unlocked" ? "btn--primary" : "btn--ghost"}`} onClick={onOpenHub}>
              <Icon name="gift" size={18} /> {starter?.status === "unlocked" ? "View my reward" : "Progress & rewards"}
            </button>
          </section>

          {opp && (
            <section className="card" aria-labelledby="opp-h">
              <h2 id="opp-h" className="h3"><Icon name="leaf" size={18} /> Estimated opportunity</h2>
              <p><b>{fmt(opp.lo)}–{fmt(opp.hi)} kg CO2e</b>{opp.illustrative ? " (illustrative)" : ""} if these items are reused instead of bought new, each counted once.</p>
              <p className="fine">An estimate for this shortlist — not saved, measured or verified carbon. <button className="link-btn" onClick={onShowMethod}>Method</button></p>
            </section>
          )}

          <div className="row-actions">
            <button className="btn btn--small btn--ghost" onClick={onEditRequest}><Icon name="edit" size={16} /> Edit request</button>
            {!confirmDelete ? (
              <button className="btn btn--small btn--ghost danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Delete project</button>
            ) : (
              <div className="confirm" role="alert">
                <span>Delete “{p.name}” from this browser? This can’t be undone.</span>
                <button className="btn btn--small btn--danger" onClick={onDelete}>Delete</button>
                <button className="btn btn--small btn--ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
