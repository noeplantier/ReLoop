import { useId, useState } from "react";
import { Icon } from "./Icon";
import { PRESETS } from "../lib/presets";
import { locateNearestPreset, LOCATE_TEXT } from "../lib/geo";

/** Demo area select plus an explicit "Use my location" (permission asked only on click, exact position never kept). */
export function AreaPicker({ value, onChange, label = "Area", invalid, onLight, idHint }: {
  value: string;
  onChange: (presetId: string, via: "manual" | "approx_location") => void;
  label?: string;
  invalid?: boolean;
  onLight?: boolean;
  idHint?: string;
}) {
  const auto = useId();
  const id = idHint ?? auto;
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok?: boolean }>({ busy: false, msg: null });

  async function locate() {
    setState({ busy: true, msg: null });
    const r = await locateNearestPreset();
    if (r.ok) {
      onChange(r.preset.id, "approx_location");
      setState({ busy: false, ok: true, msg: `Nearest demo area: ${r.preset.name}. Your exact position isn’t stored.` });
    } else {
      setState({ busy: false, msg: LOCATE_TEXT[r.reason] });
    }
  }

  return (
    <div className="field">
      <div className="field__row">
        <label className="field__label" htmlFor={id}><Icon name="pin" size={18} /> {label}</label>
        <button type="button" className={`link-btn ${onLight ? "link-btn--light" : ""}`} onClick={locate} disabled={state.busy}>
          <Icon name="locate" size={16} /> {state.busy ? "Locating…" : "Use my location"}
        </button>
      </div>
      <div className="select">
        <select id={id} className="input" value={value} aria-invalid={invalid || undefined}
          onChange={(e) => {
            onChange(e.target.value, "manual");
            setState({ busy: false, msg: null });
          }}>
          <option value="">Choose a demo area…</option>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Icon name="chevron" size={18} />
      </div>
      <p className={`field__note ${state.msg && !state.ok ? "field__note--warn" : ""}`} role={state.msg ? "status" : undefined}>
        {state.msg ?? "Demo areas in Antalya only. Distances are approximate."}
      </p>
    </div>
  );
}
