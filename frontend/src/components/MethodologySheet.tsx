import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { api } from "../lib/api";
import type { DataMode } from "../lib/config";
import { METHODOLOGY, type Methodology } from "../demo/demo";

// "How we calculate": everything comes from the backend (GET /impact/methodology) or, in demo mode,
// from the same response recorded in the fixtures. No number is written in the frontend.
export function MethodologySheet({ mode, onClose }: { mode: DataMode; onClose: () => void }) {
  const [data, setData] = useState<Methodology | null>(mode === "demo" ? METHODOLOGY : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "live") return;
    api.methodology().then(setData).catch((e) => setError(e?.message ?? "Could not load the methodology."));
  }, [mode]);

  return (
    <Dialog title="How we calculate the climate impact" eyebrow="Methodology" onClose={onClose} wide>
        {error && <p className="err">{error}</p>}
        {!data && !error && <p className="is-muted">Loading…</p>}
        {data && (
          <div className="sheet__body">
            <p className="notice notice--info">
              <Icon name="info" size={16} />
              <span>Scenario-based estimate for decision support. It is not measured or verified impact.</span>
            </p>
            <p>{data.summary}</p>

            <h3>Formula</h3>
            <dl className="kv">
              {Object.entries(data.formula).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>

            <h3>Emission factors</h3>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th className="num">Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.factors.map((f) => (
                    <tr key={f.id}>
                      <td>{f.label}</td>
                      <td className="num">{f.value}</td>
                      <td>{f.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small is-muted">
              Source: {data.dataset.name}
              {data.dataset.published ? ` (${data.dataset.published})` : ""}
              {data.dataset.licence ? `, ${data.dataset.licence}` : ""}.{" "}
              {data.dataset.url && (
                <a href={data.dataset.url} target="_blank" rel="noreferrer">
                  Open the dataset
                </a>
              )}
            </p>

            <h3>Assumptions</h3>
            <ul className="plain">
              {data.assumptions.map((a) => (
                <li key={a.id}>
                  {a.note ?? a.id}
                  {a.status && <span className="src-chip"> {a.status}</span>}
                </li>
              ))}
            </ul>

            <h3>Not counted</h3>
            <ul className="plain">
              {data.not_counted.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>

            <h3>Limitations</h3>
            <ul className="plain">
              {data.limitations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
    </Dialog>
  );
}
