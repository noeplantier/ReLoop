// Offline DEMO engine: a line-by-line port of backend/match.py, backend/impact.py and the template
// explanations in ai/explain.py, running on a copy of backend/data/inventory.json (fictional data).
// Used ONLY when the user explicitly selects "Demo inventory". Keep in sync with the Python originals.
import inventory from "./inventory.json";
import factors from "./impact_factors.json";
import type { Category, Explanation, ExplainOut, MatchOut, MatchRequest, MatchResponse, Need, ParseOut } from "../lib/types";
import { PRESETS } from "../lib/presets";

type Item = (typeof inventory.items)[number];
type Window = Item["availability"][number];

const CONDITION_RANK: Record<string, number> = { fair: 0, good: 1, excellent: 2 };
const CONDITION_SCORE: Record<string, number> = { fair: 0.4, good: 0.7, excellent: 1.0 };
const MATCHABLE_MODES = ["loan", "rental"];
const WEIGHTS = { distance: 0.5, condition: 0.3, price: 0.2 };
const DISTANCE_SCALE_KM = 50;
const TOP_N = 3;

const suppliers = Object.fromEntries(inventory.suppliers.map((s) => [s.id, s]));
const round = (x: number, n: number) => Math.round(x * 10 ** n) / 10 ** n;
const dayMs = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / dayMs);

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371, rad = Math.PI / 180;
  const p1 = lat1 * rad, p2 = lat2 * rad, dp = p2 - p1, dl = (lon2 - lon1) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function coveringWindow(item: Item, start: string, end: string): Window | null {
  for (const w of item.availability) {
    if (w.available_from <= start && w.available_until >= end && w.quantity_available > 0) return w;
  }
  return null;
}

function eligible(req: MatchRequest) {
  const minCond = req.requirements?.min_condition ? CONDITION_RANK[req.requirements.min_condition] : null;
  const maxKm = req.requirements?.max_distance_km ?? null;
  const out: { item: Item; window: Window; km: number }[] = [];
  for (const it of inventory.items) {
    if (it.category !== req.category || !MATCHABLE_MODES.includes(it.reuse_mode)) continue;
    const w = coveringWindow(it, req.start_date, req.end_date);
    if (!w) continue;
    if (minCond !== null && CONDITION_RANK[it.condition] < minCond) continue;
    const sup = suppliers[it.supplier_id];
    const km = haversineKm(req.location.lat, req.location.lon, sup.latitude, sup.longitude);
    if (maxKm !== null && km > maxKm) continue;
    out.push({ item: it, window: w, km });
  }
  return out;
}

function impact(item: Item, quantity: number, distanceKm: number): MatchOut["impact"] {
  const mats = factors.material_kgco2e_per_tonne_primary_production as unknown as Record<string, { value: number | null; source: string; status?: string }>;
  const w = item.weight_kg, mat = item.main_material;
  const mf = mat ? mats[mat] : undefined;
  if (!w || !mf || mf.value == null) {
    return { avoided_kgco2e: null, status: "unavailable", assumptions: ["Weight, material or emission factor missing for this item."] };
  }
  const tonnes = (w / 1000) * quantity;
  const embodied = tonnes * mf.value;
  const assumptions = [
    `Avoided: producing ${quantity} new unit(s) of ${mat.replace(/_/g, " ")}, about ${w} kg each = ${tonnes.toFixed(3)} t x ${mf.value} kgCO2e/t = ${embodied.toFixed(1)} kgCO2e.`,
    `Factor source: ${mf.source}`,
  ];
  const t = factors.transport_kgco2e_per_tonne_km;
  const transport = t.value * tonnes * distanceKm;
  assumptions.push(`Delivery deducted: ${t.value} kgCO2e/t-km x ${tonnes.toFixed(3)} t x ${distanceKm.toFixed(1)} km = ${transport.toFixed(2)} kgCO2e (one-way, rigid diesel truck).`);
  const isEstimate = item.weight_is_estimate ?? true;
  if (isEstimate) assumptions.push("Item weight and material are rough estimates for demo data.");
  assumptions.push("Proxy: UK Defra 2025 factors, not Turkey-specific; use phase and end-of-life ignored.");
  return {
    avoided_kgco2e: round(Math.max(embodied - transport, 0), 2),
    status: isEstimate || mf.status !== "sourced" ? "illustrative" : "sourced",
    assumptions,
  };
}

export function demoMatch(req: MatchRequest): MatchResponse {
  const cands = eligible(req);
  const prices = cands.map((c) => c.item.unit_price_per_day_try ?? 0);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const days = daysBetween(req.start_date, req.end_date) + 1;
  const rows = cands.map((c, i) => {
    const ps = hi === lo ? 1 : 1 - (prices[i] - lo) / (hi - lo);
    const distS = Math.exp(-c.km / DISTANCE_SCALE_KM);
    const condS = CONDITION_SCORE[c.item.condition];
    const score = WEIGHTS.distance * distS + WEIGHTS.condition * condS + WEIGHTS.price * ps;
    const quoted = Math.min(req.quantity, c.window.quantity_available);
    const price = c.item.unit_price_per_day_try ?? null;
    const sup = suppliers[c.item.supplier_id];
    const distance = round(c.km, 1);
    const m: MatchOut = {
      item_id: c.item.id, name: c.item.name,
      supplier: { id: sup.id, name: sup.name, city: sup.city },
      reuse_mode: c.item.reuse_mode, condition: c.item.condition,
      available_quantity: c.window.quantity_available, quoted_quantity: quoted,
      covers_quantity: c.window.quantity_available >= req.quantity,
      distance_km: distance, unit_price_per_day_try: price,
      estimated_cost_try: price ? round(price * quoted * days, 2) : null,
      score: round(score, 3),
      breakdown: { distance_score: round(distS, 3), condition_score: condS, price_score: round(ps, 3), weights: { ...WEIGHTS } },
      explanation: null,
      impact: impact(c.item, quoted, distance),
    };
    return m;
  });
  rows.sort((a, b) => Number(!a.covers_quantity) - Number(!b.covers_quantity) || b.score - a.score || (a.item_id < b.item_id ? -1 : 1));
  return { request_id: req.request_id ?? null, days, total_options: rows.length, matches: rows.slice(0, TOP_N), suggestions: [] };
}

// ---------- template explanations (port of ai/explain.py) ----------

const fmt = (x: number) => (Math.abs(x) >= 100 || Number.isInteger(x) ? Math.round(x).toLocaleString("en-US") : x.toFixed(1));

export function templateExplanation(m: MatchOut, req: MatchRequest, label: string): Explanation {
  const days = daysBetween(req.start_date, req.end_date) + 1;
  const missing = req.quantity - m.quoted_quantity;
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
    reasons.push(`${word}: about ${fmt(m.impact.avoided_kgco2e)} kgCO2e avoided compared with buying new (see assumptions).`);
  }
  const checks = ["deposit", "damage responsibility", "return conditions", "pickup or delivery"];
  if (!m.covers_quantity) checks.push("where to get the missing units");
  if (m.estimated_cost_try == null) checks.push("whether the loan is really free of charge");
  return { item_id: m.item_id, summary, reasons, things_to_check: checks,
           avoided_kgco2e: m.impact.avoided_kgco2e, impact_status: m.impact.status, source: "template" };
}

export function demoExplain(req: MatchRequest, need: Need, matches: MatchOut[]): ExplainOut {
  return { explanations: matches.map((m) => templateExplanation(m, req, need.label)), explainer: "template" };
}

// ---------- minimal offline parser (subset of ai/rules.py: quantities and categories) ----------

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

/** Dates and location come from the form fields in demo mode; text only gives the equipment. */
export function demoParse(text: string, startDate: string, endDate: string, presetId: string): ParseOut {
  const needs = new Map<Category, Need>();
  const warnings: string[] = [];
  const cleaned = text.toLowerCase()
    .replace(/\d{1,2}(st|nd|rd|th)?\s*(-|–|to|until)\s*\d{1,2}(st|nd|rd|th)?\s+[a-z]+/g, " ")
    .replace(/\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g, " ")
    .replace(/\b\d{4}\b/g, " ")
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
    requirements: { min_condition: null, max_distance_km: null },
    missing_fields: missing,
    warnings,
    parser: "rules",
  };
}
