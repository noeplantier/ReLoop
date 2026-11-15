// Live backend calls. Never silently replaced by demo data: failures throw ApiError and the UI
// offers the user an explicit choice (fill in manually / switch to demo inventory).
import { API_URL } from "./config";
import type { ExplainOut, InventorySource, MatchOut, MatchRequest, MatchResponse, Need, ParseOut } from "./types";
import type { Methodology } from "../demo/demo";
import type { ProjectBrief } from "./project";

export class ApiError extends Error {
  constructor(message: string, readonly kind: "not_configured" | "network" | "timeout" | "http", readonly status?: number) {
    super(message);
  }
}

// Render's free plan sleeps; the first request can take ~50 s.
const TIMEOUT_MS = 70_000;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new ApiError("The live backend URL is not configured yet.", "not_configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw ctrl.signal.aborted
      ? new ApiError("The server took too long to answer.", "timeout")
      : new ApiError("Could not reach the server.", "network");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = `Server error (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") msg = body.error;
    } catch {
      /* keep default message */
    }
    throw new ApiError(msg, "http", res.status);
  }
  return res.json() as Promise<T>;
}

export interface ShortlistCheckItem {
  item_id: string;
  need_category: string;
  status: "available" | "partial" | "unavailable" | "unknown_item";
  requested_quantity: number;
  available_quantity: number | null;
  missing_quantity: number | null;
  note?: string;
}

export interface ShortlistCheckOut {
  inventory_source: InventorySource;
  note: string;
  items: ShortlistCheckItem[];
}

export const api = {
  /** Read-only re-check of a saved shortlist (POST /shortlist/check). Never reserves anything. */
  shortlistCheck: (brief: ProjectBrief, shortlist: { need_category: string; item_id: string; quantity: number }[]) =>
    call<ShortlistCheckOut>("/shortlist/check", { method: "POST", body: JSON.stringify({ brief, shortlist }) }),
  health: () => call<{ status: string; inventory_source: InventorySource }>("/health"),
  methodology: () => call<Methodology>("/impact/methodology"),
  parse: (text: string, today: string) =>
    call<ParseOut>("/parse-request", { method: "POST", body: JSON.stringify({ text, context: { today } }) }),
  match: (req: MatchRequest) => call<MatchResponse>("/match", { method: "POST", body: JSON.stringify(req) }),
  explain: (req: MatchRequest, need: Need, matches: MatchOut[]) =>
    call<ExplainOut>("/explain", {
      method: "POST",
      body: JSON.stringify({
        request: { category: req.category, quantity: req.quantity, start_date: req.start_date,
                   end_date: req.end_date, label: need.label },
        matches,
      }),
    }),
};
