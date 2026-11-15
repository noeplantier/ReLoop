// Saved projects, browser-local only (docs/PROJECT_PROGRESS_CONTRACT.md, Part A).
// The project document follows the shared schema "reloop.project/v1" exactly, so the backend can re-check it
// (/shortlist/check, /progress/evaluate) and a server could store it later without changes.
// Display-only extras (e.g. the engine's carbon range per item) live NEXT to the project, never inside it.
// The raw text the user typed is never stored (it may contain personal data).
import type { Category, Condition, ImpactStatus, InventorySource, MatchOut, Priority } from "./types";
import type { DataMode } from "./config";

export type ProjectEventType =
  | "brief_confirmed" | "details_viewed" | "shortlist_added" | "shortlist_removed" | "project_reopened" | "brief_changed";

export interface ProjectBrief {
  needs: { category: Category; quantity: number; label: string }[];
  start_date: string;
  end_date: string;
  location: { preset_id: string; lat: number; lon: number; label?: string };
  requirements: { min_condition: Condition | null; max_distance_km: number | null } | null;
  priority: Priority | null;
}

export interface ShortlistEntry {
  need_category: Category;
  item_id: string;
  quantity: number;
  added_at: string;
  snapshot: {
    name: string;
    supplier_name: string;
    distance_km: number;
    estimated_cost_try: number | null;
    inventory_source: string;
    checked_at: string;
  };
}

export interface ReloopProject {
  schema: "reloop.project/v1";
  id: string;
  name: string;
  mode: DataMode;
  created_at: string;
  updated_at: string;
  brief: ProjectBrief;
  brief_confirmed_at: string | null;
  shortlist: ShortlistEntry[];
  events: { type: ProjectEventType; at: string; item_id?: string }[];
}

/** Engine numbers kept for display only (never sent as part of the project). */
export interface ItemDisplay {
  avoided_kgco2e: number | null;
  avoided_kgco2e_conservative: number | null;
  impact_status: ImpactStatus;
  available_quantity: number;
  condition: string;
}

interface Stored {
  project: ReloopProject;
  display: Record<string, ItemDisplay>;
}

const KEY = "reloop.projects.v1";
const MAX_PROJECTS = 10;
const MAX_EVENTS = 200;
const MAX_SHORTLIST = 20;

const now = () => new Date().toISOString();
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Is localStorage usable here? (private windows and blocked site data can throw) */
export function storageAvailable(): boolean {
  try {
    const k = "__reloop_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readAll(): Stored[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Stored[]) : [];
    return Array.isArray(list) ? list.filter((s) => s?.project?.schema === "reloop.project/v1") : [];
  } catch {
    return [];
  }
}

function writeAll(list: Stored[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_PROJECTS)));
    return true;
  } catch {
    return false;
  }
}

export function listProjects(): Stored[] {
  return readAll().sort((a, b) => b.project.updated_at.localeCompare(a.project.updated_at));
}

export function loadProject(id: string): Stored | null {
  return readAll().find((s) => s.project.id === id) ?? null;
}

/** Saves (insert or replace). Returns false when the browser refuses storage. */
export function saveProject(s: Stored): boolean {
  const rest = readAll().filter((x) => x.project.id !== s.project.id);
  return writeAll([s, ...rest]);
}

export function deleteProject(id: string): boolean {
  return writeAll(readAll().filter((x) => x.project.id !== id));
}

export function newProject(brief: ProjectBrief, mode: DataMode, name: string): Stored {
  const t = now();
  return {
    project: {
      schema: "reloop.project/v1", id: uid(), name: name.slice(0, 80), mode,
      created_at: t, updated_at: t, brief, brief_confirmed_at: t, shortlist: [],
      events: [{ type: "brief_confirmed", at: t }],
    },
    display: {},
  };
}

export function withEvent(p: ReloopProject, type: ProjectEventType, item_id?: string): ReloopProject {
  const t = now();
  const ev = item_id ? { type, at: t, item_id } : { type, at: t };
  return { ...p, updated_at: t, events: [...p.events, ev].slice(-MAX_EVENTS) };
}

export function briefChanged(s: Stored, brief: ProjectBrief): Stored {
  const t = now();
  const p = withEvent({ ...s.project, brief, brief_confirmed_at: t }, "brief_changed");
  // Shortlisted items for needs that no longer exist are dropped; the rest stay and get re-checked.
  const cats = new Set(brief.needs.map((n) => n.category));
  return { ...s, project: { ...p, shortlist: p.shortlist.filter((e) => cats.has(e.need_category)) } };
}

export function addToShortlist(s: Stored, m: MatchOut, category: Category, source: InventorySource | string): Stored {
  if (s.project.shortlist.some((e) => e.item_id === m.item_id)) return s;
  if (s.project.shortlist.length >= MAX_SHORTLIST) return s;
  const t = now();
  const entry: ShortlistEntry = {
    need_category: category, item_id: m.item_id, quantity: m.quoted_quantity, added_at: t,
    snapshot: {
      name: m.name.slice(0, 120), supplier_name: m.supplier.name.slice(0, 120), distance_km: m.distance_km,
      estimated_cost_try: m.estimated_cost_try, inventory_source: String(source).slice(0, 32), checked_at: t,
    },
  };
  const p = withEvent({ ...s.project, shortlist: [...s.project.shortlist, entry] }, "shortlist_added", m.item_id);
  return {
    project: p,
    display: {
      ...s.display,
      [m.item_id]: {
        avoided_kgco2e: m.impact.avoided_kgco2e, avoided_kgco2e_conservative: m.impact.avoided_kgco2e_conservative ?? null,
        impact_status: m.impact.status, available_quantity: m.available_quantity, condition: m.condition,
      },
    },
  };
}

export function removeFromShortlist(s: Stored, itemId: string): Stored {
  const p = withEvent({ ...s.project, shortlist: s.project.shortlist.filter((e) => e.item_id !== itemId) },
    "shortlist_removed", itemId);
  const display = { ...s.display };
  delete display[itemId];
  return { project: p, display };
}

/** Sum of the engine's ranges for the current shortlist, each item counted once. */
export function estimatedOpportunity(s: Stored): { lo: number; hi: number; illustrative: boolean } | null {
  let lo = 0, hi = 0, any = false, illustrative = false;
  const seen = new Set<string>();
  for (const e of s.project.shortlist) {
    if (seen.has(e.item_id)) continue;
    seen.add(e.item_id);
    const d = s.display[e.item_id];
    if (!d || d.avoided_kgco2e == null) continue;
    any = true;
    hi += d.avoided_kgco2e;
    lo += d.avoided_kgco2e_conservative ?? d.avoided_kgco2e;
    if (d.impact_status !== "sourced") illustrative = true;
  }
  return any ? { lo, hi, illustrative } : null;
}

export type { Stored as StoredProject };
