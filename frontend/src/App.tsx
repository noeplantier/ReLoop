import { useRef, useState } from "react";
import { Header } from "./components/Header";
import { RequestScreen, type RequestDraft } from "./screens/RequestScreen";
import { ReviewScreen, type ReviewedRequest } from "./screens/ReviewScreen";
import { ResultsScreen, type NeedResult } from "./screens/ResultsScreen";
import { api, ApiError } from "./lib/api";
import type { DataMode } from "./lib/config";
import { presetById } from "./lib/presets";
import type { Explanation, InventorySource, MatchRequest, ParseOut } from "./lib/types";
import { demoExplain, demoMatch, demoParse } from "./demo/engine";

type Step = "request" | "review" | "results";

const EMPTY: RequestDraft = { text: "", startDate: "", endDate: "", location: "" };
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Typed form fields win over what was read from the text. */
function toReviewed(p: ParseOut, d: RequestDraft): ReviewedRequest {
  return {
    needs: p.needs,
    startDate: d.startDate || p.start_date || "",
    endDate: d.endDate || p.end_date || "",
    location: d.location || p.location.preset_id || "",
    minCondition: p.requirements.min_condition ?? "",
    maxDistanceKm: p.requirements.max_distance_km ? String(p.requirements.max_distance_km) : "",
  };
}

export default function App() {
  const [mode, setMode] = useState<DataMode>("live");
  const [step, setStep] = useState<Step>("request");
  const [draft, setDraft] = useState<RequestDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParseOut | null>(null);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<ReviewedRequest | null>(null);
  const [results, setResults] = useState<NeedResult[]>([]);
  const [source, setSource] = useState<InventorySource | null>(null);
  const runId = useRef(0);

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  async function submitRequest(d: RequestDraft) {
    setDraft(d);
    let p: ParseOut;
    let note: string | null = null;
    if (mode === "demo") {
      p = demoParse(d.text, d.startDate, d.endDate, d.location);
    } else {
      setBusy(true);
      try {
        p = await api.parse(d.text, today());
      } catch (e) {
        // AI/back-end parsing failed: fall back to simple rules in the browser, clearly labelled.
        note = `${e instanceof ApiError ? e.message : "Request reading failed."} We filled in what we could with simple rules.`;
        p = demoParse(d.text, d.startDate, d.endDate, d.location);
      } finally {
        setBusy(false);
      }
    }
    setParsed(note ? null : p);
    setParseNote(note);
    setReviewed(toReviewed(p, d));
    go("review");
  }

  async function search(r: ReviewedRequest, m: DataMode = mode) {
    const id = ++runId.current;
    const loc = presetById(r.location)!;
    const reqs: MatchRequest[] = r.needs.map((n) => ({
      request_id: n.category,
      category: n.category,
      quantity: n.quantity,
      start_date: r.startDate,
      end_date: r.endDate,
      location: { lat: loc.lat, lon: loc.lon },
      requirements: r.minCondition || r.maxDistanceKm
        ? { min_condition: r.minCondition || null, max_distance_km: r.maxDistanceKm ? Number(r.maxDistanceKm) : null }
        : null,
    }));
    setReviewed(r);
    setResults(r.needs.map((need) => ({ need, status: "loading" })));
    setSource(m === "demo" ? "browser_demo" : null);
    go("results");

    const update = (i: number, patch: Partial<NeedResult>) =>
      id === runId.current && setResults((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    if (m === "live") {
      api.health().then((h) => id === runId.current && setSource(h.inventory_source)).catch(() => undefined);
    }

    await Promise.all(reqs.map(async (req, i) => {
      const need = r.needs[i];
      let response;
      try {
        response = m === "demo" ? demoMatch(req) : await api.match(req);
      } catch (e) {
        update(i, { status: "error", error: e instanceof ApiError ? e.message : "unexpected error" });
        return;
      }
      update(i, { status: "ok", response, explaining: response.matches.length > 0 });
      if (!response.matches.length) return;
      let exps: Explanation[];
      let explainNote: string | undefined;
      if (m === "demo") {
        exps = demoExplain(req, need, response.matches).explanations;
      } else {
        try {
          exps = (await api.explain(req, need, response.matches)).explanations;
        } catch {
          // Explanation service down: standard text from the SAME real engine results.
          exps = demoExplain(req, need, response.matches).explanations;
          explainNote = "AI unavailable";
        }
      }
      update(i, { explaining: false, explainNote, explanations: Object.fromEntries(exps.map((x) => [x.item_id, x])) });
    }));
  }

  return (
    <div className="app">
      <Header mode={mode} />
      {step === "request" && (
        <RequestScreen draft={draft} mode={mode} busy={busy} onModeChange={setMode} onSubmit={submitRequest} />
      )}
      {step === "review" && reviewed && (
        <ReviewScreen
          key={JSON.stringify(reviewed)}
          parsed={parsed}
          parseNote={parseNote}
          initial={reviewed}
          onBack={() => go("request")}
          onConfirm={(r) => search(r)}
        />
      )}
      {step === "results" && reviewed && (
        <ResultsScreen
          results={results}
          source={source}
          placeLabel={presetById(reviewed.location)?.name ?? ""}
          dateLabel={`${fmtDate(reviewed.startDate)}–${fmtDate(reviewed.endDate)}`}
          onEdit={() => go("review")}
          onRetry={() => search(reviewed)}
          onSwitchToDemo={mode === "live" ? () => {
            setMode("demo");
            search(reviewed, "demo");
          } : undefined}
        />
      )}
    </div>
  );
}
