// DEMO mode: replays REAL backend responses recorded by backend/tools/export_demo_fixtures.py
// (fictional inventory, LLM off). No matching or carbon logic lives in the browser, so demo numbers
// can never differ from the backend. Requests that are not one of the recorded scenarios are refused
// with a clear message instead of being guessed. Copy refreshed with `npm run sync:fixtures`.
import fixtures from "./demo_scenarios.json";
import type { Category, Explanation, ExplainOut, MatchOut, MatchRequest, MatchResponse, Need, ParseOut, Priority } from "../lib/types";
import { PRESETS, type PresetId } from "../lib/presets";

type Scenario = { label: string; request: MatchRequest; response: MatchResponse };
const SCENARIOS = fixtures.scenarios as unknown as Record<string, Scenario>;

export const METHODOLOGY = fixtures.methodology as unknown as Methodology;
export const FIXTURE_COMMIT: string = fixtures.meta.backend_commit;

export interface Methodology {
  summary: string;
  formula: Record<string, string>;
  dataset: { name: string; published?: string; url?: string; licence?: string; caveat?: string };
  factors: { id: string; label: string; value: number; unit: string; status?: string; source?: string }[];
  assumptions: { id: string; value: number | null; status?: string; note?: string }[];
  status_labels: Record<string, string>;
  not_counted: string[];
  limitations: string[];
}

export class DemoNotCovered extends Error {}

const key = (r: MatchRequest) =>
  [r.category, r.quantity, r.start_date, r.end_date, r.location.lat.toFixed(4), r.location.lon.toFixed(4),
   r.priority || "balanced", r.requirements?.min_condition || "", r.requirements?.max_distance_km ?? ""].join("|");

const BY_KEY = new Map(Object.values(SCENARIOS).map((s) => [key(s.request), s]));

export function demoMatch(req: MatchRequest): MatchResponse {
  const s = BY_KEY.get(key(req));
  if (!s) {
    throw new DemoNotCovered(
      "The demo inventory only has a few prepared examples, and this request is not one of them. " +
        "Pick one of the demo examples on the first screen, or switch to Live inventory.",
    );
  }
  return { ...s.response, request_id: req.request_id ?? s.response.request_id };
}

// Prepared examples for the request screen. Each one maps to recorded scenarios above.
export interface DemoExample {
  id: string;
  title: string;
  text: string;
  startDate: string;
  endDate: string;
  location: PresetId;
}

export const DEMO_EXAMPLES: DemoExample[] = [
  { id: "main", title: "Main demo: 50 chairs + 2 stage lights, Lara",
    text: "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026.",
    startDate: "2026-11-21", endDate: "2026-11-23", location: "lara" },
  { id: "big", title: "Big order: 200 chairs, Konyaalti",
    text: "We need 200 chairs near Konyaalti from 21 to 23 November 2026.",
    startDate: "2026-11-21", endDate: "2026-11-23", location: "konyaalti" },
  { id: "partial", title: "Partial match: 400 chairs, Lara",
    text: "400 chairs near Lara, 21 to 23 November 2026.",
    startDate: "2026-11-21", endDate: "2026-11-23", location: "lara" },
  { id: "cheapest", title: "Cheapest first: 50 chairs, Lara",
    text: "50 chairs near Lara, 21 to 23 November 2026, cheapest first.",
    startDate: "2026-11-21", endDate: "2026-11-23", location: "lara" },
  { id: "filters", title: "With filters: 60 chairs, good condition, within 20 km",
    text: "60 chairs near Lara in good condition, within 20 km, 21 to 23 November 2026.",
    startDate: "2026-11-21", endDate: "2026-11-23", location: "lara" },
  { id: "tables", title: "10 tables, Belek",
    text: "10 tables near Belek from 21 to 23 November 2026.",
    startDate: "2026-11-21", endDate: "2026-11-23", location: "belek" },
  { id: "none", title: "Nothing available: 10 chairs in January",
    text: "10 chairs near Lara on 10 to 11 January 2027.",
    startDate: "2027-01-10", endDate: "2027-01-11", location: "lara" },
];

// ---------- template explanations (same wording as ai/explain.py) ----------

const dayMs = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / dayMs);

export const fmt = (x: number) => (Math.abs(x) >= 100 || Number.isInteger(x) ? Math.round(x).toLocaleString("en-US") : x.toFixed(1));

/** Same wording as ai/explain.py co2_range(): "95.6–956", or "about 956" when there is no lower bound. */
export function co2Range(i: MatchOut["impact"]): string {
  const hi = i.avoided_kgco2e!, lo = i.avoided_kgco2e_conservative;
  return lo != null && fmt(lo) !== fmt(hi) ? `${fmt(lo)}–${fmt(hi)}` : `about ${fmt(hi)}`;
}

export function templateExplanation(m: MatchOut, req: MatchRequest, label: string): Explanation {
  const days = daysBetween(req.start_date, req.end_date) + 1;
  const missing = m.missing_quantity ?? req.quantity - m.quoted_quantity;
  const summary = m.covers_quantity
    ? `${m.name} from ${m.supplier.name} covers all ${req.quantity} ${label} for your ${days}-day event.`
    : `${m.name} from ${m.supplier.name} covers ${m.quoted_quantity} of ${req.quantity} ${label}; ${missing} are still missing.`;
  const reasons = [
    m.distance_km < 0.5 ? "It is at your selected location (under 1 km away)." : `It is about ${fmt(m.distance_km)} km from your location.`,
    `Condition is rated ${m.condition}; it is offered as a ${m.reuse_mode}.`,
    m.covers_quantity
      ? `${m.available_quantity} units are free for all your dates, so your ${req.quantity} are covered.`
      : `Only ${m.available_quantity} units are free for your dates.`,
    m.estimated_cost_try != null
      ? `Estimated rental: ${fmt(m.estimated_cost_try)} TRY for ${days} days (delivery and deposit not included).`
      : "No rental price is listed for this item.",
  ];
  if (m.impact.avoided_kgco2e != null) {
    const word = m.impact.status === "illustrative" ? "Illustrative estimate" : "Estimate";
    reasons.push(`${word}: ${co2Range(m.impact)} kgCO2e avoided compared with buying new (see assumptions).`);
  }
  const checks = ["deposit", "damage responsibility", "return conditions", "pickup or delivery"];
  if (!m.covers_quantity) checks.push("where to get the missing units");
  if (m.estimated_cost_try == null) checks.push("whether the loan is really free of charge");
  return { item_id: m.item_id, summary, reasons, things_to_check: checks,
           avoided_kgco2e: m.impact.avoided_kgco2e, avoided_kgco2e_conservative: m.impact.avoided_kgco2e_conservative ?? null,
           impact_status: m.impact.status, source: "template" };
}

export function demoExplain(req: MatchRequest, need: Need, matches: MatchOut[]): ExplainOut {
  return { explanations: matches.map((m) => templateExplanation(m, req, need.label)), explainer: "template" };
}

// ---------- minimal offline reading of the request text (no AI; equipment, filters, priority) ----------

const NOUNS: Record<string, Category> = {
  chair: "chairs", chairs: "chairs", seat: "chairs", seats: "chairs", stool: "chairs", stools: "chairs",
  table: "tables", tables: "tables",
  light: "lighting", lights: "lighting", lighting: "lighting", lamp: "lighting", lamps: "lighting",
  spotlight: "lighting", spotlights: "lighting", uplighter: "lighting", uplighters: "lighting",
  sign: "signage", signs: "signage", signage: "signage", banner: "signage", banners: "signage",
  stage: "staging", stages: "staging", staging: "staging", platform: "staging", platforms: "staging",
  podium: "staging", podiums: "staging", riser: "staging", risers: "staging",
};
const STOP = new Set(["and", "or", "near", "in", "at", "for", "from", "on", "between", "with", "by", "within", "to"]);

/** Dates and location come from the form fields in demo mode; the text gives equipment, filters and priority. */
export function demoParse(text: string, startDate: string, endDate: string, presetId: string): ParseOut {
  const needs = new Map<Category, Need>();
  const warnings: string[] = [];
  const low = text.toLowerCase();
  const cleaned = low
    .replace(/\d{1,2}(st|nd|rd|th)?\s*(-|–|to|until)\s*\d{1,2}(st|nd|rd|th)?\s+[a-z]+/g, " ")
    .replace(/\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/within\s+\d+\s*km/g, " ");
  for (const m of cleaned.matchAll(/\b(\d{1,6})\s*(?:x\s*)?([a-z-]+(?:\s+[a-z-]+){0,3})/g)) {
    const qty = Number(m[1]);
    const words: string[] = [];
    for (const w of m[2].split(/\s+/)) {
      if (STOP.has(w)) break;
      words.push(w);
    }
    if (!qty || !words.length) continue;
    let idx = -1;
    for (let i = words.length - 1; i >= 0; i--) {
      if (NOUNS[words[i]]) {
        idx = i;
        break;
      }
    }
    const cat = idx >= 0 ? NOUNS[words[idx]] : undefined;
    if (!cat) {
      if (!["km", "days", "day", "people", "guests", "persons", "pm", "am", "h", "hours"].includes(words[0])) {
        warnings.push(`'${qty} ${words.join(" ")}' is not in our inventory categories (tables, chairs, lighting, signage, staging).`);
      }
      continue;
    }
    const label = words.slice(0, idx + 1).join(" ") || cat;
    const prev = needs.get(cat);
    needs.set(cat, prev ? { category: cat, quantity: prev.quantity + qty, label: `${prev.label} + ${label}` } : { category: cat, quantity: qty, label });
  }
  const km = low.match(/within\s+(\d+)\s*km/);
  const minCondition = /\b(excellent|like[\s-]new)\b/.test(low) ? "excellent" : /\bgood condition\b/.test(low) ? "good" : null;
  const priority: Priority | null = /\bcheapest\b/.test(low) ? "cheapest" : /\bclosest\b|\bnearest\b/.test(low) ? "closest"
    : /\bbest condition\b/.test(low) ? "best_condition" : null;
  const p = PRESETS.find((x) => x.id === presetId);
  const missing: ParseOut["missing_fields"] = [];
  if (!needs.size) missing.push("needs");
  if (!startDate || !endDate) missing.push("dates");
  if (!p) missing.push("location");
  return {
    needs: [...needs.values()],
    start_date: startDate || null,
    end_date: endDate || null,
    location: { place_text: p?.name ?? null, preset_id: p?.id ?? null, preset_label: p?.name ?? null, lat: p?.lat ?? null, lon: p?.lon ?? null },
    requirements: { min_condition: minCondition, max_distance_km: km ? Number(km[1]) : null },
    priority,
    missing_fields: missing,
    warnings,
    parser: "rules",
  };
}
