// Extra digital badges. Each one is derived from something the SERVER confirmed (a progress milestone from
// /progress/evaluate, or offers accepted by /offer/validate). The first unlock is recorded in this browser so
// it never counts twice. Badges have no monetary value and prove no exchange or carbon saving.
const KEY = "reloop.badges.v1";

export interface BadgeDef {
  id: string;
  title: string;
  rule: string;
  milestone?: string; // server milestone id
  offers?: number; // number of server-checked offers
}

export const BADGES: BadgeDef[] = [
  { id: "comparer", title: "Careful comparer", rule: "Open the details of two options for the same equipment.", milestone: "options_compared" },
  { id: "full_cover", title: "Full cover", rule: "Shortlist enough to cover every item, still available.", milestone: "shortlist_complete" },
  { id: "local_hero", title: "Local first", rule: "Keep every shortlisted supplier within 15 km.", milestone: "local_first" },
  { id: "loop_back", title: "Back in the loop", rule: "Reopen a saved project and update it.", milestone: "returned_and_updated" },
  { id: "sharer", title: "Sharer", rule: "Save one equipment offer.", offers: 1 },
  { id: "generous", title: "Generous sharer", rule: "Save three equipment offers.", offers: 3 },
];

export function loadBadges(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Records first unlocks only; returns the ids that are new. */
export function recordBadges(ids: string[]): string[] {
  const all = loadBadges();
  const fresh = ids.filter((id) => !all[id] && BADGES.some((b) => b.id === id));
  if (!fresh.length) return [];
  const t = new Date().toISOString();
  for (const id of fresh) all[id] = t;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: session only */
  }
  return fresh;
}

export function resetBadges() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const badgesFromMilestones = (done: string[]) => BADGES.filter((b) => b.milestone && done.includes(b.milestone)).map((b) => b.id);
export const badgesFromOffers = (n: number) => BADGES.filter((b) => b.offers && n >= b.offers).map((b) => b.id);
