// Mirrors backend/models.py and ai/schemas.py. Keep in sync with docs/API_CONTRACT.md.
export type Category = "tables" | "chairs" | "lighting" | "signage" | "staging";
export type Condition = "fair" | "good" | "excellent";
export type ImpactStatus = "sourced" | "illustrative" | "unavailable";

export const CATEGORIES: { slug: Category; name: string; unit: string }[] = [
  { slug: "chairs", name: "Chairs", unit: "chair" },
  { slug: "tables", name: "Tables", unit: "table" },
  { slug: "lighting", name: "Lighting", unit: "light" },
  { slug: "staging", name: "Staging", unit: "platform" },
  { slug: "signage", name: "Signage", unit: "sign" },
];

export interface Need {
  category: Category;
  quantity: number;
  label: string;
}

export interface ParseOut {
  needs: Need[];
  start_date: string | null;
  end_date: string | null;
  location: {
    place_text: string | null;
    preset_id: string | null;
    preset_label: string | null;
    lat: number | null;
    lon: number | null;
  };
  requirements: { min_condition: Condition | null; max_distance_km: number | null };
  missing_fields: ("needs" | "dates" | "location")[];
  warnings: string[];
  parser: "llm" | "rules";
}

export interface MatchRequest {
  request_id?: string;
  category: Category;
  quantity: number;
  start_date: string;
  end_date: string;
  location: { lat: number; lon: number };
  requirements?: { min_condition?: Condition | null; max_distance_km?: number | null } | null;
  priority?: Priority | null;
}

export type Priority = "balanced" | "closest" | "cheapest" | "best_condition";

export interface Impact {
  avoided_kgco2e: number | null; // upper bound: new items bought for this event alone
  avoided_kgco2e_conservative?: number | null; // production shared over assumed uses (illustrative)
  transport_kgco2e?: number | null; // round trip, already deducted from both bounds
  status: ImpactStatus;
  basis?: { upper: string; conservative: string } | null;
  assumptions: string[];
}

export interface MatchOut {
  item_id: string;
  name: string;
  supplier: { id: string; name: string; city: string };
  reuse_mode: string;
  condition: string;
  available_quantity: number;
  quoted_quantity: number;
  missing_quantity: number;
  covers_quantity: boolean;
  distance_km: number;
  unit_price_per_day_try: number | null;
  estimated_cost_try: number | null;
  score: number;
  breakdown: Record<string, unknown>;
  explanation: string | null;
  impact: Impact;
}

export interface MatchResponse {
  request_id: string | null;
  days: number;
  total_options: number;
  matches: MatchOut[];
  suggestions: { type: string; detail: string }[];
  inventory_source?: InventorySource; // older backends omit it
  cost_note?: string;
}

export interface Explanation {
  item_id: string;
  summary: string;
  reasons: string[];
  things_to_check: string[];
  avoided_kgco2e: number | null;
  avoided_kgco2e_conservative?: number | null;
  impact_status: ImpactStatus;
  source: "llm" | "template";
}

export interface ExplainOut {
  explanations: Explanation[];
  explainer: "llm" | "template";
}

/** Where the inventory behind a result set came from. */
export type InventorySource = "supabase" | "json_fallback" | "browser_demo";
