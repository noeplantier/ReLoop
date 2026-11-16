import type { DataMode } from "../lib/config";
import { Logo } from "./Brand";
import { Icon } from "./Icon";

export type Area = "home" | "hub" | "profile";

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

const ITEMS: { id: Area; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "hub", label: "My ReLoop", icon: "loop" },
  { id: "profile", label: "Profile", icon: "user" },
];

/** Brand bar on top; navigation sits in the bar on wide screens and docks at the bottom on phones. */
export function Header({ mode, area, onNavigate, initials, rewardDot }: {
  mode: DataMode;
  area: Area | null;
  onNavigate: (a: Area) => void;
  initials: string;
  rewardDot: boolean;
}) {
  return (
    <header className="topnav">
      <button type="button" className="brand" onClick={() => onNavigate("home")} aria-label="ReLoop home">
        <Logo size={30} />
        <span className="brand__name">ReLoop</span>
      </button>
      <nav className="navbar" aria-label="Main">
        {ITEMS.map((it) => (
          <button key={it.id} type="button" className={`navbar__item ${area === it.id ? "is-on" : ""}`}
            aria-current={area === it.id ? "page" : undefined} onClick={() => onNavigate(it.id)}>
            {it.id === "profile" && initials
              ? <span className="avatar avatar--xs" aria-hidden="true">{initials}</span>
              : <Icon name={it.icon} size={20} />}
            <span>{it.label}</span>
            {it.id === "hub" && rewardDot && <span className="navbar__dot"><span className="sr-only">(new reward)</span></span>}
          </button>
        ))}
      </nav>
      <DataBadge mode={mode} />
    </header>
  );
}
