import { useState } from "react";
import { Icon } from "../components/Icon";
import { Steps } from "../components/Steps";
import { CATEGORIES, type Category, type Condition, type Need, type ParseOut } from "../lib/types";
import { PRESETS } from "../lib/presets";

export interface ReviewedRequest {
  needs: Need[];
  startDate: string;
  endDate: string;
  location: string; // preset id
  minCondition: Condition | "";
  maxDistanceKm: string;
}

interface Props {
  parsed: ParseOut | null; // null = parsing failed, user fills everything in
  parseNote: string | null;
  initial: ReviewedRequest;
  onBack: () => void;
  onConfirm: (r: ReviewedRequest) => void;
}

export function ReviewScreen({ parsed, parseNote, initial, onBack, onConfirm }: Props) {
  const [r, setR] = useState<ReviewedRequest>(initial);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof ReviewedRequest>(k: K, v: ReviewedRequest[K]) => setR((p) => ({ ...p, [k]: v }));

  const setNeed = (i: number, patch: Partial<Need>) =>
    setR((p) => ({ ...p, needs: p.needs.map((n, j) => (j === i ? { ...n, ...patch } : n)) }));
  const removeNeed = (i: number) => setR((p) => ({ ...p, needs: p.needs.filter((_, j) => j !== i) }));
  const usedCats = new Set(r.needs.map((n) => n.category));
  const freeCat = CATEGORIES.find((c) => !usedCats.has(c.slug));
  const addNeed = () =>
    freeCat && setR((p) => ({ ...p, needs: [...p.needs, { category: freeCat.slug, quantity: 1, label: freeCat.name.toLowerCase() }] }));

  const problems = {
    needs: r.needs.length === 0 || r.needs.some((n) => !Number.isInteger(n.quantity) || n.quantity < 1),
    dates: !r.startDate || !r.endDate || r.endDate < r.startDate,
    location: !r.location,
  };
  const ok = !problems.needs && !problems.dates && !problems.location;
  const flagged = (f: "needs" | "dates" | "location") => (tried && problems[f]) || parsed?.missing_fields.includes(f);

  return (
    <main className="page">
      <div className="topbar">
        <button className="link-back" onClick={onBack}>
          <Icon name="back" size={18} /> Back
        </button>
      </div>
      <Steps current={1} />
      <h1 className="page__title">Review your request</h1>
      <p className="page__sub">Check the details before we search. You can change anything.</p>

      {parsed ? (
        <p className="source-note">
          <Icon name="sparkle" size={16} />
          {parsed.parser === "llm" ? "Read by AI from your text." : "Read from your text with standard rules (AI not used)."}{" "}
          Please check it.
        </p>
      ) : (
        <p className="notice notice--warn" role="status">
          {parseNote ?? "We could not read your request automatically."} Please fill in the details below.
        </p>
      )}
      {parsed?.warnings.map((w) => (
        <p key={w} className="notice notice--warn">
          {w}
        </p>
      ))}

      <section className={`panel ${flagged("needs") ? "panel--flag" : ""}`} aria-labelledby="eq-h">
        <h2 id="eq-h" className="panel__h">
          <Icon name="chair" /> Equipment
        </h2>
        {r.needs.length === 0 && <p className="panel__empty">No equipment yet. Add what you need.</p>}
        <ul className="needs">
          {r.needs.map((n, i) => (
            <li key={i} className="need">
              <select
                className="need__cat"
                aria-label="Category"
                value={n.category}
                onChange={(e) => {
                  const c = CATEGORIES.find((x) => x.slug === e.target.value)!;
                  setNeed(i, { category: c.slug as Category, label: c.name.toLowerCase() });
                }}
              >
                {CATEGORIES.filter((c) => c.slug === n.category || !usedCats.has(c.slug)).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              {n.label.toLowerCase() !== CATEGORIES.find((c) => c.slug === n.category)?.name.toLowerCase() && (
                <span className="need__label">“{n.label}”</span>
              )}
              <div className="stepper" role="group" aria-label={`Quantity of ${n.label}`}>
                <button type="button" aria-label="Decrease" onClick={() => setNeed(i, { quantity: Math.max(1, n.quantity - 1) })}>
                  <Icon name="minus" size={18} />
                </button>
                <input
                  inputMode="numeric"
                  aria-label="Quantity"
                  value={n.quantity}
                  onChange={(e) => setNeed(i, { quantity: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                />
                <button type="button" aria-label="Increase" onClick={() => setNeed(i, { quantity: n.quantity + 1 })}>
                  <Icon name="plus" size={18} />
                </button>
              </div>
              <button type="button" className="need__rm" aria-label={`Remove ${n.label}`} onClick={() => removeNeed(i)}>
                <Icon name="x" size={18} />
              </button>
            </li>
          ))}
        </ul>
        {freeCat && (
          <button type="button" className="link-add" onClick={addNeed}>
            <Icon name="plus" size={16} /> Add equipment
          </button>
        )}
      </section>

      <section className={`panel ${flagged("dates") ? "panel--flag" : ""}`} aria-labelledby="dt-h">
        <h2 id="dt-h" className="panel__h">
          <Icon name="calendar" /> Event dates
        </h2>
        <div className="dates">
          <label className="date">
            <span className="date__cap">From</span>
            <input type="date" className="input input--dark" value={r.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className="date">
            <span className="date__cap">To</span>
            <input type="date" className="input input--dark" value={r.endDate} min={r.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} />
          </label>
        </div>
        {r.startDate && r.endDate && r.endDate < r.startDate && <p className="err">The end date is before the start date.</p>}
      </section>

      <section className={`panel ${flagged("location") ? "panel--flag" : ""}`} aria-labelledby="lc-h">
        <h2 id="lc-h" className="panel__h">
          <Icon name="pin" /> Location
        </h2>
        <div className="select select--dark">
          <select className="input input--dark" aria-label="Location" value={r.location} onChange={(e) => set("location", e.target.value)}>
            <option value="">Choose a demo location…</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={18} />
        </div>
        {parsed?.location.place_text && !parsed.location.preset_id && (
          <p className="panel__hint">You wrote “{parsed.location.place_text}”. It is not one of our demo locations.</p>
        )}
      </section>

      <details className="panel panel--more">
        <summary className="panel__h">Optional filters</summary>
        <div className="filters">
          <label className="date">
            <span className="date__cap">Minimum condition</span>
            <select className="input input--dark" value={r.minCondition} onChange={(e) => set("minCondition", e.target.value as Condition | "")}>
              <option value="">Any</option>
              <option value="good">Good or better</option>
              <option value="excellent">Excellent only</option>
            </select>
          </label>
          <label className="date">
            <span className="date__cap">Max distance (km)</span>
            <input className="input input--dark" inputMode="numeric" placeholder="Any" value={r.maxDistanceKm}
              onChange={(e) => set("maxDistanceKm", e.target.value.replace(/[^\d]/g, ""))} />
          </label>
        </div>
      </details>

      {tried && !ok && (
        <p className="err" role="alert">
          Please complete the highlighted sections.
        </p>
      )}
      <button
        className="btn btn--primary"
        onClick={() => {
          setTried(true);
          if (ok) onConfirm(r);
        }}
      >
        <Icon name="search" /> Confirm and search <Icon name="arrow" />
      </button>
      <p className="foot foot--tag">
        <Icon name="leaf" size={18} /> Reuse. Reduce. ReLoop.
      </p>
    </main>
  );
}
