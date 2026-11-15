import { createContext, useContext, useState } from "react";
import { Icon } from "../components/Icon";
import { Steps } from "../components/Steps";
import type { Category, Explanation, InventorySource, MatchOut, MatchResponse, Need } from "../lib/types";
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

const ShortlistCtx = createContext<{
  ids: Set<string>;
  toggle: (m: MatchOut, category: Category) => void;
  viewed: (itemId: string) => void;
}>({ ids: new Set(), toggle: () => undefined, viewed: () => undefined });

const CAT_ICON: Record<Category, Parameters<typeof Icon>[0]["name"]> = {
  chairs: "chair", tables: "table", lighting: "light", staging: "stage", signage: "sign",
};

const SOURCE_TEXT: Record<InventorySource, string> = {
  supabase: "Live inventory",
  json_fallback: "Live server, offline dataset (fictional)",
  browser_demo: "Demo: recorded results (fictional)",
};

const tl = (x: number) => `TRY ${Math.round(x).toLocaleString("en-US")}`;

export function ResultsScreen({
  results, source, placeLabel, dateLabel, onEdit, onRetry, onSwitchToDemo, onShowMethod,
  shortlistIds, onToggleShortlist, onDetailsViewed, shortlistCount, saved, onOpenShortlist,
}: Props) {
  const anyError = results.some((r) => r.status === "error");
  const anyNotInDemo = results.some((r) => r.status === "not_in_demo");
  return (
    <ShortlistCtx.Provider value={{ ids: shortlistIds, toggle: onToggleShortlist, viewed: onDetailsViewed }}>
    <main className="page page--wide page--with-bar">
      <div className="topbar">
        <button className="link-back" onClick={onEdit}>
          <Icon name="back" size={18} /> Edit request
        </button>
        {source && <span className={`src src--${source}`}>{SOURCE_TEXT[source]}</span>}
      </div>
      <Steps current={2} />
      <h1 className="page__title">Your reuse options</h1>
      <p className="page__meta">
        <Icon name="pin" size={16} /> {placeLabel} · {dateLabel}
      </p>
      <p className="notice notice--info">
        <Icon name="info" size={16} /> Each option is a single item from one supplier. Options for different equipment are
        separate offers, not a combined package.
      </p>

      {anyError && (
        <div className="notice notice--error" role="alert">
          <p>Some results could not be loaded from the live server.</p>
          <div className="notice__actions">
            <button className="btn btn--small" onClick={onRetry}>Try again</button>
            {onSwitchToDemo && (
              <button className="btn btn--small btn--ghost" onClick={onSwitchToDemo}>
                Use demo inventory (fictional)
              </button>
            )}
          </div>
        </div>
      )}

      {anyNotInDemo && (
        <div className="notice notice--warn" role="status">
          <Icon name="info" size={16} />
          <span>
            Demo mode only replays a few prepared examples recorded from our real backend, so some of your request has no
            demo result. Choose a demo example on the first screen, or switch to Live inventory.
          </span>
        </div>
      )}

      {results.length > 1 && (
        <nav className="jump" aria-label="Jump to equipment">
          {results.map((r) => (
            <a key={r.need.category} className="jump__chip" href={`#sec-${r.need.category}`}>
              <Icon name={CAT_ICON[r.need.category]} size={16} /> {r.need.label}
              {r.status === "ok" && <span className="jump__n">{r.response!.matches.length}</span>}
            </a>
          ))}
        </nav>
      )}

      {results.map((r) => (
        <NeedSection key={r.need.category} r={r} onShowMethod={onShowMethod} />
      ))}

      <button className="link-method" onClick={onShowMethod}>
        <Icon name="leaf" size={16} /> How we calculate the climate impact
      </button>

      <div className="sl-bar" role="region" aria-label="Your shortlist">
        <div className="sl-bar__text">
          <b>Shortlist: {shortlistCount} item{shortlistCount === 1 ? "" : "s"}</b>
          <span>{saved ? "Saved in this browser" : "Not saved: this browser blocks storage"}</span>
        </div>
        <button className="btn btn--small" onClick={onOpenShortlist}>
          View shortlist <Icon name="arrow" size={16} />
        </button>
      </div>
    </main>
    </ShortlistCtx.Provider>
  );
}

function NeedSection({ r, onShowMethod }: { r: NeedResult; onShowMethod: () => void }) {
  const { need } = r;
  const [collapsed, setCollapsed] = useState(false);
  const matches = r.response?.matches ?? [];
  const best = matches[0];
  const summary =
    r.status !== "ok"
      ? null
      : matches.length === 0
        ? "No available option for these dates"
        : best.covers_quantity
          ? `Fully covered · ${r.response!.total_options > matches.length
              ? `top ${matches.length} of ${r.response!.total_options} options`
              : `${matches.length} option${matches.length === 1 ? "" : "s"}`}`
          : `Only partly covered · best option has ${best.quoted_quantity} of ${need.quantity}`;

  return (
    <section className="need-sec" id={`sec-${need.category}`} aria-labelledby={`h-${need.category}`}>
      <h2 className="need-sec__hwrap">
        <button type="button" className="need-sec__head need-sec__toggle" aria-expanded={!collapsed}
          aria-controls={`body-${need.category}`} onClick={() => setCollapsed((c) => !c)}>
          <span className="need-sec__icon">
            <Icon name={CAT_ICON[need.category]} size={22} />
          </span>
          <span className="need-sec__titles">
            <span id={`h-${need.category}`} className="need-sec__title">
              {need.quantity} {need.label}
            </span>
            {summary && (
              <span className={`need-sec__sum ${matches.length && best.covers_quantity ? "is-ok" : "is-warn"}`}>{summary}</span>
            )}
          </span>
          <span className={`need-sec__chev ${collapsed ? "" : "is-open"}`} aria-hidden="true">
            <Icon name="chevron" size={20} />
          </span>
        </button>
      </h2>
      <div id={`body-${need.category}`} hidden={collapsed} className="need-sec__body">

      {r.status === "loading" && (
        <div className="skeleton" aria-busy="true" aria-label={`Loading ${need.label}`}>
          <div />
          <div />
        </div>
      )}
      {r.status === "error" && <p className="err">Could not load options for {need.label}: {r.error}</p>}
      {r.status === "not_in_demo" && (
        <p className="empty">No demo result for {need.quantity} {need.label} with these details.</p>
      )}
      {r.status === "ok" && matches.length === 0 && (
        <div className="empty">
          <p>No {need.label} are available for your full dates and filters.</p>
          {r.response!.suggestions.map((s) => (
            <p key={s.detail} className="empty__tip">
              <Icon name="sparkle" size={16} /> {s.detail}
            </p>
          ))}
          <p className="empty__tip">Try other dates, a wider distance or a lower minimum condition.</p>
        </div>
      )}
      <div className="cards">
        {matches.map((m, i) => (
          <OptionCard key={m.item_id} m={m} need={need} rank={i} days={r.response!.days}
            exp={r.explanations?.[m.item_id]} explaining={r.explaining} explainNote={r.explainNote}
            costNote={r.response!.cost_note} onShowMethod={onShowMethod} />
        ))}
      </div>
      </div>
    </section>
  );
}

function OptionCard({ m, need, rank, days, exp, explaining, explainNote, costNote, onShowMethod }: {
  m: MatchOut; need: Need; rank: number; days: number; exp?: Explanation; explaining?: boolean; explainNote?: string;
  costNote?: string; onShowMethod: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sl = useContext(ShortlistCtx);
  const inList = sl.ids.has(m.item_id);
  const missing = m.missing_quantity ?? need.quantity - m.quoted_quantity;
  const tag = !m.covers_quantity ? { t: "Partial match", c: "tag--warn" } : rank === 0 ? { t: "Best match", c: "tag--best" } : null;

  return (
    <article className="opt">
      <div className="opt__top">
        {tag && <span className={`tag ${tag.c}`}>{tag.t}</span>}
        <h3 className="opt__name">{m.name}</h3>
        <p className="opt__sup">{m.supplier.name}</p>
      </div>

      <ul className="opt__facts">
        <li className={m.covers_quantity ? "is-ok" : "is-warn"}>
          <Icon name={m.covers_quantity ? "check" : "warn"} size={18} />
          <span>
            <b>{m.quoted_quantity}/{need.quantity}</b> {need.label}
            {!m.covers_quantity && <> · <b>{missing} missing</b></>}
          </span>
        </li>
        <li>
          <Icon name="pin" size={18} />
          <span>{m.distance_km < 0.5 ? "At your location" : `~${m.distance_km} km away`} · condition {m.condition}</span>
        </li>
      </ul>

      <div className="opt__price">
        {m.estimated_cost_try != null ? (
          <>
            <span className="opt__amount">{tl(m.estimated_cost_try)}</span>
            <span className="opt__per">estimated rental for {days} day{days === 1 ? "" : "s"}</span>
          </>
        ) : (
          <span className="opt__per">No rental price listed ({m.reuse_mode})</span>
        )}
        <span className="opt__excl" title={costNote}>
          <Icon name="info" size={14} /> Rental only: delivery, deposit, setup and taxes not included
        </span>
      </div>

      <div className="opt__why">
        {exp ? (
          <p className="opt__summary">{exp.summary}</p>
        ) : explaining ? (
          <p className="opt__summary is-muted">Writing explanation…</p>
        ) : null}
        {exp && (
          <span className={`src-chip ${exp.source === "llm" ? "src-chip--ai" : ""}`}>
            {exp.source === "llm" ? "AI explanation, checked against engine data" : explainNote ? "Rules-based explanation · LLM unavailable" : "Rules-based explanation · LLM disabled"}
          </span>
        )}
      </div>

      <div className="opt__actions">
        <button className={`btn ${inList ? "btn--outline is-in" : "btn--primary"}`} aria-pressed={inList}
          onClick={() => sl.toggle(m, need.category)}>
          <Icon name={inList ? "check" : "plus"} size={18} /> {inList ? "In shortlist" : "Add to shortlist"}
        </button>
        <button className="btn btn--outline" aria-expanded={open} disabled={!exp} onClick={() => {
          if (!open) sl.viewed(m.item_id);
          setOpen((o) => !o);
        }}>
          {open ? "Hide details" : "View details"} <Icon name={open ? "chevron" : "arrow"} size={18} />
        </button>
      </div>

      {open && exp && (
        <div className="opt__details">
          <h4>Why this match?</h4>
          <ul className="ticks">
            {exp.reasons.map((x) => (
              <li key={x}>
                <Icon name="check" size={16} /> {x}
              </li>
            ))}
          </ul>
          <h4>Things to check with the supplier</h4>
          <ul className="plain">
            {exp.things_to_check.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <div className="impact">
            <Icon name="leaf" size={22} />
            <div>
              <p className="impact__h">Climate impact</p>
              {m.impact.avoided_kgco2e != null ? (
                <>
                  <p>
                    {m.impact.status === "illustrative" ? "Illustrative estimate" : "Estimate"}:{" "}
                    <b>{co2Range(m.impact)} kgCO2e</b> avoided compared with buying new.
                  </p>
                  {m.impact.basis && m.impact.avoided_kgco2e_conservative != null && (
                    <p className="impact__basis">
                      Low end: {m.impact.basis.conservative} High end: {m.impact.basis.upper}
                    </p>
                  )}
                </>
              ) : (
                <p>Not enough data to estimate the impact of this item.</p>
              )}
              <p className="impact__basis">Scenario-based estimate, not measured or verified.</p>
              <button className="link-inline" onClick={onShowMethod}>How we calculate →</button>
              <details>
                <summary>View assumptions for this item</summary>
                <ul className="plain small">
                  {m.impact.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
