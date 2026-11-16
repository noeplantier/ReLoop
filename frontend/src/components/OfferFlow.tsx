import { useState } from "react";
import { Icon } from "./Icon";
import { AreaPicker } from "./AreaPicker";
import { EquipmentArt } from "./EquipmentArt";
import { CATEGORIES, type Category, type Condition } from "../lib/types";
import { presetById } from "../lib/presets";
import { offerProblems, uid, type Offer, type StoredOffer } from "../lib/local";

const STEPS = ["Describe", "Quantity", "Dates", "Area", "Review"] as const;
const CONDITIONS: { id: Condition; label: string; hint: string }[] = [
  { id: "excellent", label: "Excellent", hint: "Like new" },
  { id: "good", label: "Good", hint: "Light signs of use" },
  { id: "fair", label: "Fair", hint: "Works, visibly used" },
];

type Draft = { category: Category; label: string; quantity: string; condition: Condition; from: string; to: string; area: string };

// Kept for the session so switching tabs or screens doesn't lose what was typed.
let pending: { draft: Draft; step: number } | null = null;

const fromOffer = (o: Offer): Draft => ({
  category: o.category, label: o.label, quantity: String(o.quantity), condition: o.condition,
  from: o.available_from, to: o.available_to, area: o.location.preset_id,
});
const blank = (area: string): Draft => ({ category: "chairs", label: "", quantity: "", condition: "good", from: "", to: "", area });
const fmtDay = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function OfferFlow({ editing, defaultArea, onSave, onDone, onManage, rewardUnlocked, onViewReward, offerCount, max }: {
  editing?: StoredOffer | null;
  defaultArea: string;
  /** Returns an error message, or null when saved. */
  onSave: (o: Offer, isEdit: boolean) => Promise<{ error: string | null; checked: boolean }>;
  onDone?: () => void;
  onManage: () => void;
  rewardUnlocked: boolean;
  onViewReward: () => void;
  offerCount: number;
  max: number;
}) {
  const [d, setD] = useState<Draft>(() => editing ? fromOffer(editing.offer) : pending?.draft ?? blank(defaultArea));
  const [step, setStep] = useState(() => (editing ? 4 : pending?.step ?? 0));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ checked: boolean } | null>(null);

  const remember = (nd: Draft, ns: number) => {
    if (!editing) pending = { draft: nd, step: ns };
  };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => {
    const n = { ...p, [k]: v };
    remember(n, step);
    return n;
  });

  const preset = presetById(d.area);
  const offer: Offer = {
    id: editing?.offer.id ?? "", category: d.category, label: d.label.trim(), quantity: Number(d.quantity),
    condition: d.condition, available_from: d.from, available_to: d.to,
    location: { preset_id: d.area, lat: preset?.lat ?? 0, lon: preset?.lon ?? 0 },
    created_at: editing?.offer.created_at ?? "",
  };
  const problems = offerProblems(offer);
  const stepProblem = [problems.label, problems.quantity, problems.dates, problems.location, undefined][step];
  const full = !editing && offerCount >= max;

  const go = (n: number) => {
    setTried(false);
    setError(null);
    setStep(n);
    remember(d, n);
  };
  const next = () => {
    setTried(true);
    if (!stepProblem) go(step + 1);
  };

  async function save() {
    const firstBad = [problems.label, problems.quantity, problems.dates, problems.location].findIndex(Boolean);
    if (firstBad >= 0) {
      go(firstBad);
      setTried(true);
      return;
    }
    setBusy(true);
    setError(null);
    const final = { ...offer, id: offer.id || uid(), created_at: offer.created_at || new Date().toISOString() };
    const r = await onSave(final, !!editing);
    setBusy(false);
    if (r.error) return setError(r.error);
    pending = null;
    setDone({ checked: r.checked });
  }

  if (done) {
    return (
      <div className="offer-flow offer-done" role="status">
        <div className="offer-done__icon"><Icon name="check" size={28} /></div>
        <h3 className="panel-title">{editing ? "Offer updated" : "Offer saved"}</h3>
        <p className="local-label"><Icon name="info" size={16} /> Saved in this browser — not visible to others yet.</p>
        {!done.checked && <p className="field__note field__note--warn">The ReLoop server couldn’t be reached, so this offer hasn’t been checked yet. We’ll check it next time you open My ReLoop.</p>}
        <p className="muted">Thanks for sharing what you have. Copy the summary from My ReLoop to share it yourself.</p>
        <div className="row-actions">
          {rewardUnlocked
            ? <button type="button" className="btn btn--primary" onClick={onViewReward}><Icon name="gift" size={18} /> View my reward</button>
            : <button type="button" className="btn btn--primary" onClick={onManage}>Manage my offers <Icon name="arrow" size={18} /></button>}
          {rewardUnlocked && <button type="button" className="btn btn--ghost" onClick={onManage}>Manage my offers</button>}
          {!editing && (
            <button type="button" className="btn btn--ghost" onClick={() => {
              setD(blank(d.area));
              setDone(null);
              go(0);
            }}>Offer something else</button>
          )}
          {editing && onDone && <button type="button" className="btn btn--ghost" onClick={onDone}>Close</button>}
        </div>
      </div>
    );
  }

  if (full) {
    return (
      <div className="offer-flow">
        <p className="muted">You have {max} offers saved in this browser, the most this prototype keeps. Remove one in My ReLoop to add another.</p>
        <button type="button" className="btn btn--primary" onClick={onManage}>Manage my offers</button>
      </div>
    );
  }

  return (
    <form className="offer-flow" noValidate onSubmit={(e) => {
      e.preventDefault();
      step < 4 ? next() : save();
    }}>
      <ol className="mini-steps" aria-label="Offer steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "is-done" : i === step ? "is-on" : ""} aria-current={i === step ? "step" : undefined}>
            <span className="sr-only">{i < step ? "Done: " : ""}</span>{s}
          </li>
        ))}
      </ol>

      <div className="offer-flow__body">
        {step === 0 && (
          <>
            <fieldset className="field">
              <legend className="field__label"><Icon name="box" size={18} /> What can you share?</legend>
              <div className="chip-row" role="radiogroup" aria-label="Equipment type">
                {CATEGORIES.map((c) => (
                  <button key={c.slug} type="button" role="radio" aria-checked={d.category === c.slug}
                    className={`chip-opt ${d.category === c.slug ? "is-on" : ""}`} onClick={() => set("category", c.slug)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label className="field__label" htmlFor="of-label">Short name</label>
              <input id="of-label" className="input" maxLength={80} placeholder="e.g. Folding chairs, white" value={d.label}
                onChange={(e) => set("label", e.target.value)} aria-invalid={(tried && !!problems.label) || undefined}
                aria-describedby="of-label-hint" />
              <p id="of-label-hint" className={`field__note ${tried && problems.label ? "field__note--err" : ""}`}>
                {tried && problems.label ? problems.label : "No contact details: this stays in your browser."}
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="of-qty">How many?</label>
              <input id="of-qty" className="input input--num" type="number" inputMode="numeric" min={1} max={100000} value={d.quantity}
                onChange={(e) => set("quantity", e.target.value)} aria-invalid={(tried && !!problems.quantity) || undefined} />
              {tried && problems.quantity && <p className="field__note field__note--err">{problems.quantity}</p>}
            </div>
            <fieldset className="field">
              <legend className="field__label">Condition</legend>
              <div className="seg" role="radiogroup" aria-label="Condition">
                {CONDITIONS.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={d.condition === c.id}
                    className={`seg__opt ${d.condition === c.id ? "is-on" : ""}`} onClick={() => set("condition", c.id)}>
                    <b>{c.label}</b><span>{c.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <fieldset className="field">
            <legend className="field__label"><Icon name="calendar" size={18} /> When is it available?</legend>
            <div className="dates">
              <label className="date"><span className="date__cap">From</span>
                <input type="date" className="input" value={d.from} onChange={(e) => set("from", e.target.value)} />
              </label>
              <label className="date"><span className="date__cap">To</span>
                <input type="date" className="input" value={d.to} min={d.from || undefined} onChange={(e) => set("to", e.target.value)}
                  aria-invalid={(tried && !!problems.dates) || undefined} />
              </label>
            </div>
            <p className={`field__note ${tried && problems.dates ? "field__note--err" : ""}`}>
              {tried && problems.dates ? problems.dates : "Up to 180 days."}
            </p>
          </fieldset>
        )}

        {step === 3 && (
          <>
            <AreaPicker value={d.area} onChange={(v) => set("area", v)} label="Approximate area" invalid={tried && !!problems.location} />
            {tried && problems.location && <p className="field__note field__note--err">{problems.location}</p>}
            <p className="field__note">Only the area is kept, never a street address.</p>
          </>
        )}

        {step === 4 && (
          <div className="offer-review">
            <EquipmentArt category={d.category} />
            <dl className="kv">
              <div><dt>Equipment</dt><dd>{offer.label || "—"} <button type="button" className="link-btn" onClick={() => go(0)}>Edit</button></dd></div>
              <div><dt>Quantity</dt><dd>{d.quantity || "—"} · {d.condition} <button type="button" className="link-btn" onClick={() => go(1)}>Edit</button></dd></div>
              <div><dt>Available</dt><dd>{d.from && d.to ? `${fmtDay(d.from)} – ${fmtDay(d.to)}` : "—"} <button type="button" className="link-btn" onClick={() => go(2)}>Edit</button></dd></div>
              <div><dt>Area</dt><dd>{preset?.name ?? "—"} <button type="button" className="link-btn" onClick={() => go(3)}>Edit</button></dd></div>
            </dl>
            <p className="local-label"><Icon name="info" size={16} /> Saved in this browser — not visible to others yet.</p>
          </div>
        )}
        {error && <p className="alert" role="alert">{error}</p>}
      </div>

      <div className="offer-flow__nav">
        {step > 0 && (!editing || step < 4) && (
          <button type="button" className="btn btn--ghost" onClick={() => go(step - 1)}><Icon name="back" size={18} /> Back</button>
        )}
        {editing && onDone && <button type="button" className="btn btn--ghost" onClick={onDone}>Cancel</button>}
        <button type="submit" className="btn btn--primary" disabled={busy} aria-busy={busy}>
          {step < 4 ? <>Continue <Icon name="arrow" size={18} /></> : busy ? "Saving…" : editing ? "Save changes" : "Save in this browser"}
        </button>
      </div>
    </form>
  );
}
