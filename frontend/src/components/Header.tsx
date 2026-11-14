import type { DataMode } from "../lib/config";

export function DataBadge({ mode }: { mode: DataMode }) {
  return (
    <span className={`badge badge--${mode}`} title={mode === "demo"
      ? "Results come from the fictional offline demo inventory"
      : "Results come from the live ReLoop inventory"}>
      <span className="badge__dot" aria-hidden="true" />
      {mode === "demo" ? "Demo inventory" : "Live inventory"}
    </span>
  );
}

export function Header({ mode }: { mode: DataMode }) {
  return (
    <header className="header">
      <a className="brand" href="/" aria-label="ReLoop home">
        <img src="/logo-mark.png" alt="" width={34} height={36} />
        <span className="brand__name">ReLoop</span>
      </a>
      <DataBadge mode={mode} />
    </header>
  );
}
