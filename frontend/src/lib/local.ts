// Browser-local data that is NOT part of a saved project: the profile on this device, the user's equipment
// offers and earned digital achievements. Nothing here is an account, nothing is synced or published.
// Every read and write is wrapped: private windows and blocked site data can throw.
import type { Category, Condition } from "./types";
import { presetById } from "./presets";

const K_PROFILE = "reloop.profile.v1";
const K_OFFERS = "reloop.offers.v1";
const K_ACH = "reloop.achievements.v1";
export const MAX_OFFERS = 20; // same cap as backend/offers.py
export const MAX_SPAN_DAYS = 180;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/* ---------- profile on this device ---------- */

export interface Profile {
  name: string;
  area: string; // demo preset id, "" = not chosen. Never exact coordinates.
  areaVia: "manual" | "approx_location" | "";
}
export const EMPTY_PROFILE: Profile = { name: "", area: "", areaVia: "" };

export function loadProfile(): Profile {
  const p = read<Partial<Profile>>(K_PROFILE, {});
  return {
    name: typeof p.name === "string" ? p.name.slice(0, 40) : "",
    area: typeof p.area === "string" && presetById(p.area) ? p.area : "",
    areaVia: p.areaVia === "manual" || p.areaVia === "approx_location" ? p.areaVia : "",
  };
}
export const saveProfile = (p: Profile) => write(K_PROFILE, p);

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/* ---------- equipment offers (this browser only) ---------- */

export interface Offer {
  id: string;
  category: Category;
  label: string;
  quantity: number;
  condition: Condition;
  available_from: string;
  available_to: string;
  location: { preset_id: string; lat: number; lon: number };
  created_at: string;
}

export interface StoredOffer {
  offer: Offer;
  updated_at: string;
  /** "valid": accepted by POST /offer/validate. "unchecked": saved while the server was unreachable. */
  check: "valid" | "unchecked";
  area_label?: string; // approximate label from the server
}

export function listOffers(): StoredOffer[] {
  const list = read<StoredOffer[]>(K_OFFERS, []);
  return Array.isArray(list) ? list.filter((s) => s?.offer?.id && s.offer.category) : [];
}
export function upsertOffer(s: StoredOffer): boolean {
  const rest = listOffers().filter((x) => x.offer.id !== s.offer.id);
  return write(K_OFFERS, [s, ...rest].slice(0, MAX_OFFERS));
}
export function deleteOffer(id: string): boolean {
  return write(K_OFFERS, listOffers().filter((x) => x.offer.id !== id));
}

/** Same rules as backend/models.py Offer, so the user sees problems before the server does. */
export function offerProblems(o: Partial<Offer>): Partial<Record<"label" | "quantity" | "dates" | "location", string>> {
  const p: Partial<Record<"label" | "quantity" | "dates" | "location", string>> = {};
  const label = (o.label ?? "").trim();
  if (!label) p.label = "Give it a short name, e.g. “Folding chairs, white”.";
  else if (label.length > 80) p.label = "Keep the name under 80 characters.";
  else if (/@|http|www\./i.test(label)) p.label = "No contact details or links in the name.";
  else if (/\d{7,}/.test(label)) p.label = "No long numbers in the name (phone numbers are not accepted).";
  const q = o.quantity ?? 0;
  if (!Number.isInteger(q) || q < 1 || q > 100000) p.quantity = "Enter a quantity between 1 and 100,000.";
  if (!o.available_from || !o.available_to) p.dates = "Choose both dates.";
  else if (o.available_to < o.available_from) p.dates = "The end date is before the start date.";
  else if ((Date.parse(o.available_to) - Date.parse(o.available_from)) / 86400000 > MAX_SPAN_DAYS)
    p.dates = `Availability can be at most ${MAX_SPAN_DAYS} days.`;
  if (!o.location?.preset_id || !presetById(o.location.preset_id)) p.location = "Choose an approximate area.";
  return p;
}

/** Plain-text summary the owner can copy and share themselves (no contact details are ever added). */
export function offerSummary(o: Offer): string {
  const area = presetById(o.location.preset_id)?.name ?? "";
  const d = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `Available to reuse: ${o.quantity} × ${o.label} (${o.condition} condition), ${d(o.available_from)} – ${d(o.available_to)}, around ${area}. Shared via ReLoop (prototype; this offer is not listed publicly).`;
}

/* ---------- digital achievements ---------- */

export interface Achievement {
  id: "reuse_starter";
  unlocked_at: string;
  via: "request" | "offer";
  rules_version: string;
  seen: boolean; // congratulations already shown
}

export function loadAchievements(): Partial<Record<Achievement["id"], Achievement>> {
  const a = read<Partial<Record<Achievement["id"], Achievement>>>(K_ACH, {});
  return a && typeof a === "object" ? a : {};
}
/** Records the first unlock only: repeated evaluations, refreshes or resubmissions never change it. */
export function recordAchievement(a: Omit<Achievement, "unlocked_at" | "seen">): { achievement: Achievement; isNew: boolean } {
  const all = loadAchievements();
  const existing = all[a.id];
  if (existing) return { achievement: existing, isNew: false };
  const fresh: Achievement = { ...a, unlocked_at: new Date().toISOString(), seen: false };
  write(K_ACH, { ...all, [a.id]: fresh });
  return { achievement: fresh, isNew: true };
}
export function markAchievementSeen(id: Achievement["id"]) {
  const all = loadAchievements();
  if (all[id]) write(K_ACH, { ...all, [id]: { ...all[id], seen: true } });
}

/** "Reset this device": profile, offers and achievements. Saved projects are deleted separately. */
export function resetLocal() {
  remove(K_PROFILE);
  remove(K_OFFERS);
  remove(K_ACH);
}
