import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Steps } from "../components/Steps";
import { Dialog } from "../components/Dialog";
import { EquipmentArt } from "../components/EquipmentArt";
import type { Category, Explanation, InventorySource, MatchOut, MatchResponse, Need, Priority } from "../lib/types";
import { co2Range } from "../demo/demo";

export interface NeedResult {
  need: Need;
  status: "loading" | "ok" | "error" | "not_in_demo";
  error?: string;
  response?: MatchResponse;
  explanations?: Record<string, Explanation>;
  explaining?: boolean;
  explainNote?: string; // set when /explain failed and we show the standard text
}

interface Props {
  results: NeedResult[];
  source: InventorySource | null;
  placeLabel: string;
  dateLabel: string;
  priority: Priority;
  onPriority: (p: Priority) => void;
  canRerank: boolean; // demo mode replays recorded rankings only
  onEdit: () => void;
  onRetry: () => void;
  onSwitchToDemo?: () => void;
  onShowMethod: () => void;
  shortlistIds: Set<string>;
  onToggleShortlist: (m: MatchOut, category: Category) => void;
  onDetailsViewed: (itemId: string) => void;
  shortlistCount: number;
  saved: boolean;
  onOpenShortlist: () => void;
}

const SOURCE_TEXT: Record<InventorySource, string> = {
  supabase: "Live inventory · fictional suppliers",
  json_fallback: "Offline dataset · fictional",
  browser_demo: "Recorded demo · fictional",
};

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "closest", label: "Closest" },
  { id: "cheapest", label: "Cheapest" },
  { id: "best_condition", label: "Best condition" },
];

const tl = (x: number) => `TRY ${Math.round(x).toLocaleString("en-US")}`;

function coverage(r: NeedResult): { text: string; ok: boolean } | null {
  if (r.status === "loading") return { text: "Searching…", ok: true };
  if (r.status !== "ok") return { text: r.status === "error" ? "Couldn’t load" : "No demo result", ok: false };
  const m = r.response!.matches;
  if (!m.length) return { text: "No option for these dates", ok: false };
  return m[0].covers_quantity
    ? { text: `${m.length} option${m.length === 1 ? "" : "s"}`, ok: true }
    : { text: `Partial · best has ${m[0].quoted_quantity}/${r.need.quantity}`, ok: false };
}

export function ResultsScreen(props: Props) {
  const { results, source, placeLabel, dateLabel, priority, onPriority, canRerank, onEdit, onRetry, onSwitchToDemo, onShowMethod,
    shortlistCount, saved, onOpenShortlist } = props;
  const [cat, setCat] = useState<Category>(results[0]?.need.category ?? "chairs");
  const current = results.find((r) => r.need.category === cat) ?? results[0];
  const anyError = results.some((r) => r.status === "error");
  const [detail, setDetail] = useState<MatchOut | null>(null);

  return (
    <main className="view view--results">
      <div className="view__head">
        <div className="topbar">
          <button className="link-back" onClick={onEdit}><Icon name="back" size={18} /> Edit request</button>
          {source && <span className={`src src--${source}`}>{SOURCE_TEXT[source]}</span>}
        </div>
        <Steps current={2} />
        <div className="title-row">
          <div>
            <h1 className="h1">Your reuse options</h1>
            <p className="meta"><Icon name="pin" size={16} /> {placeLabel} · {dateLabel}</p>
          </div>
          {canRerank && <div className="prio" role="radiogroup" aria-label="Rank options by">
            {PRIORITIES.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={priority === p.id}
                className={`prio__opt ${priority === p.id ? "is-on" : ""}`} onClick={() => priority !== p.id && onPriority(p.id)}>
                {p.label}
              </button>
            ))}
          </div>}
        </div>

        {results.length > 1 && (
          <div className="cat-tabs" role="tablist" aria-label="Equipment">
            {results.map((r) => {
              const c = coverage(r);
              return (
                <button key={r.need.category} type="button" role="tab" aria-selected={r.need.category === cat}
                  className={`cat-tab ${r.need.category === cat ? "is-on" : ""}`} onClick={() => setCat(r.need.category)}>
                  <span className="cat-tab__name">{r.need.quantity} {r.need.label}</span>
                  {c && <span className={`cat-tab__sub ${c.ok ? "" : "is-warn"}`}>{c.text}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="view__body">
        {anyError && (
          <div className="notice notice--error" role="alert">
            <p>Some results couldn’t be loaded from the live server. Your shortlist is safe.</p>
            <div className="notice__actions">
              <button className="btn btn--small" onClick={onRetry}>Try again</button>
              {onSwitchToDemo && <button className="btn btn--small btn--ghost" onClick={onSwitchToDemo}>Use demo inventory (fictional)</button>}
            </div>
          </div>
        )}
        {current && <NeedCarousel key={`${current.need.category}-${priority}`} r={current} {...props} onDetails={setDetail} />}
        <p className="fine">Each option is one item from one fictional supplier, not a package or reservation.{" "}
          <button className="link-btn" onClick={onShowMethod}>How we estimate impact</button></p>
      </div>

      <div className="actionbar" role="region" aria-label="Your shortlist">
        <div className="actionbar__text">
          <b>{shortlistCount} shortlisted</b>
          <span>{saved ? "Saved in this browser" : "Not saved: storage blocked"}</span>
        </div>
        <button className={`btn ${shortlistCount ? "btn--primary" : "btn--ghost"}`} onClick={onOpenShortlist}>Review shortlist <Icon name="arrow" size={18} /></button>
      </div>

      {detail && current && (
        <DetailsDialog m={detail} need={current.need} days={current.response?.days ?? 1}
          exp={current.explanations?.[detail.item_id]} explainNote={current.explainNote}
          inList={props.shortlistIds.has(detail.item_id)} onToggle={() => props.onToggleShortlist(detail, current.need.category)}
          onShowMethod={() => {
            setDetail(null);
            onShowMethod();
          }} onClose={() => setDetail(null)} />
      )}
    </main>
  );
}

function NeedCarousel({ r, shortlistIds, onToggleShortlist, onDetailsViewed, onDetails }: Props & {
  r: NeedResult; onDetails: (m: MatchOut) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const matches = r.response?.matches ?? [];
  const n = matches.length;

  // The active slide is explicit state (arrows, keys, dots), and follows the user's own swipes.
  const goTo = (i: number) => {
    const j = Math.max(0, Math.min(n - 1, i));
    setIdx(j);
    const el = track.current?.children[j] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (el.scrollWidth <= el.clientWidth + 2) return;
        const kids = Array.from(el.children) as HTMLElement[];
        const left = el.getBoundingClientRect().left;
        const visible = kids.findIndex((k) => k.getBoundingClientRect().left >= left - 8);
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) return; // at the end: keep the chosen slide
        if (visible >= 0) setIdx(visible);
      }, 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [n]);

  if (r.status === "loading") {
    return <div className="carousel__track" aria-busy="true" aria-label={`Loading ${r.need.label}`}>
      {[0, 1, 2].map((i) => <div key={i} className="eq-card eq-card--skeleton" />)}
    </div>;
  }
  if (r.status === "error") return <p className="empty2">Couldn’t load options for {r.need.label}: {r.error}</p>;
  if (r.status === "not_in_demo") {
    return <p className="empty2">The demo replays a few recorded requests only, and has no result for {r.need.quantity} {r.need.label} with these details. Try a demo example, or switch to Live inventory.</p>;
  }
  if (!n) {
    return (
      <div className="empty2">
        <p><b>No {r.need.label} available for your full dates and filters.</b></p>
        {r.response!.suggestions.map((s) => <p key={s.detail}>{s.detail}</p>)}
        <p>Try other dates, a wider distance or a lower minimum condition.</p>
      </div>
    );
  }
  const best = matches[0];
  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={`${r.need.label} options`}>
      <div className="carousel__head">
        <p className={`carousel__sum ${best.covers_quantity ? "is-ok" : "is-warn"}`}>
          <Icon name={best.covers_quantity ? "check" : "info"} size={16} />
          {best.covers_quantity
            ? `Ranked by the matching engine · ${r.response!.total_options > n ? `top ${n} of ${r.response!.total_options}` : `${n} option${n === 1 ? "" : "s"}`}`
            : `Partial matches still help: shortlist several to cover ${r.need.quantity}.`}
        </p>
        <div className="carousel__ctrl">
          <span className="carousel__pos" aria-live="polite">{Math.min(idx + 1, n)} / {n}</span>
          <button type="button" className="icon-btn" aria-label="Previous option" disabled={idx <= 0} onClick={() => goTo(idx - 1)}><Icon name="prev" /></button>
          <button type="button" className="icon-btn" aria-label="Next option" disabled={idx >= n - 1} onClick={() => goTo(idx + 1)}><Icon name="next" /></button>
        </div>
      </div>
      <div ref={track} className="carousel__track" tabIndex={0} aria-label="Use left and right arrow keys to browse"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight") { e.preventDefault(); goTo(idx + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); goTo(idx - 1); }
        }}>
        {matches.map((m, i) => (
          <EqCard key={m.item_id} active={i === idx} m={m} need={r.need} rank={i} n={n} days={r.response!.days} exp={r.explanations?.[m.item_id]}
            explaining={r.explaining} inList={shortlistIds.has(m.item_id)}
            onToggle={() => onToggleShortlist(m, r.need.category)}
            onDetails={() => {
              onDetailsViewed(m.item_id);
              onDetails(m);
            }} />
        ))}
      </div>
      <div className="dots">
        {matches.map((m, i) => (
          <button key={m.item_id} type="button" className={i === idx ? "is-on" : ""} aria-label={`Go to option ${i + 1}`}
            aria-current={i === idx || undefined} onClick={() => goTo(i)} />
        ))}
      </div>
    </section>
  );
}

function EqCard({ active, m, need, rank, n, days, exp, explaining, inList, onToggle, onDetails }: {
  active: boolean; m: MatchOut; need: Need; rank: number; n: number; days: number; exp?: Explanation; explaining?: boolean; inList: boolean;
  onToggle: () => void; onDetails: () => void;
}) {
  const missing = m.missing_quantity ?? need.quantity - m.quoted_quantity;
  return (
    <article className={`eq-card ${inList ? "is-in" : ""} ${active ? "is-active" : ""}`} aria-current={active || undefined} aria-roledescription="slide" aria-label={`${rank + 1} of ${n}: ${m.name}`}>
      <div className="eq-card__media">
        <EquipmentArt category={need.category} />
        <span className="eq-card__rank">#{rank + 1}</span>
        {!m.covers_quantity ? <span className="pill pill--warn">Partial</span> : rank === 0 ? <span className="pill pill--brand">Best match</span> : null}
      </div>
      <div className="eq-card__body">
        <h3 className="eq-card__name">{m.name}</h3>
        <p className="eq-card__sup">{m.supplier.name} <span className="tag-fict">fictional</span></p>
        <ul className="facts">
          <li className={m.covers_quantity ? "is-ok" : "is-warn"}>
            <b>{m.quoted_quantity}/{need.quantity}</b>{!m.covers_quantity && <> · {missing} missing</>}
          </li>
          <li>{m.distance_km < 0.5 ? "At your area" : `~${m.distance_km} km`}</li>
          <li>{m.condition}</li>
        </ul>
        <p className="eq-card__price">
          {m.estimated_cost_try != null ? <><b>{tl(m.estimated_cost_try)}</b> est. for {days} day{days === 1 ? "" : "s"}</> : <>No price listed ({m.reuse_mode})</>}
          <span className="fine">Rental only · delivery, deposit and taxes extra</span>
        </p>
        <p className="eq-card__why">{exp ? exp.summary : explaining ? "Writing explanation…" : ""}</p>
      </div>
      <div className="eq-card__actions">
        <button type="button" className={`btn ${inList ? "btn--ghost is-in" : "btn--soft"}`} aria-pressed={inList} onClick={onToggle}>
          <Icon name={inList ? "check" : "plus"} size={18} /> {inList ? "Shortlisted" : "Shortlist"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDetails}>Details</button>
      </div>
    </article>
  );
}

function DetailsDialog({ m, need, days, exp, explainNote, inList, onToggle, onShowMethod, onClose }: {
  m: MatchOut; need: Need; days: number; exp?: Explanation; explainNote?: string; inList: boolean;
  onToggle: () => void; onShowMethod: () => void; onClose: () => void;
}) {
  return (
    <Dialog title={m.name} eyebrow={`${m.supplier.name} · fictional supplier`} onClose={onClose} wide
      footer={<button className={`btn ${inList ? "btn--ghost" : "btn--primary"}`} aria-pressed={inList} onClick={onToggle} data-autofocus>
        <Icon name={inList ? "check" : "plus"} size={18} /> {inList ? "Shortlisted" : "Add to shortlist"}</button>}>
      <div className="details-grid">
        <EquipmentArt category={need.category} />
        <dl className="kv">
          <div><dt>Quantity</dt><dd>{m.quoted_quantity} of {need.quantity}{!m.covers_quantity && ` · ${m.missing_quantity} missing`}</dd></div>
          <div><dt>Condition</dt><dd>{m.condition}</dd></div>
          <div><dt>Distance</dt><dd>~{m.distance_km} km (approximate)</dd></div>
          <div><dt>Cost</dt><dd>{m.estimated_cost_try != null ? `${tl(m.estimated_cost_try)} est. for ${days} day${days === 1 ? "" : "s"}, rental only` : `No price listed (${m.reuse_mode})`}</dd></div>
        </dl>
      </div>
      {exp && (
        <>
          <h3 className="h3">Why this match</h3>
          <ul className="ticks">{exp.reasons.map((x) => <li key={x}><Icon name="check" size={16} /> {x}</li>)}</ul>
          <h3 className="h3">Check with the supplier</h3>
          <ul className="plain">{exp.things_to_check.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="fine">{exp.source === "llm" ? "AI explanation, checked against engine data." : explainNote ? "Rules-based explanation (AI unavailable)." : "Rules-based explanation."}</p>
        </>
      )}
      <div className="impact2">
        <Icon name="leaf" size={20} />
        <div>
          {m.impact.avoided_kgco2e != null ? (
            <p>{m.impact.status === "illustrative" ? "Illustrative estimate" : "Scenario estimate"}: <b>{co2Range(m.impact)} kg CO2e</b> avoided compared with buying new.</p>
          ) : <p>Not enough data to estimate this item’s impact.</p>}
          <p className="fine">Scenario-based estimate, not measured or verified. <button className="link-btn" onClick={onShowMethod}>Method</button></p>
          <details className="fine">
            <summary>Assumptions</summary>
            <ul className="plain">{m.impact.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </details>
        </div>
      </div>
    </Dialog>
  );
}
