import { useRef, useState } from "react";
import { Header } from "./components/Header";
import { MethodologySheet } from "./components/MethodologySheet";
import { RequestScreen, type RequestDraft } from "./screens/RequestScreen";
import { ReviewScreen, type ReviewedRequest } from "./screens/ReviewScreen";
import { ResultsScreen, type NeedResult } from "./screens/ResultsScreen";
import { ShortlistScreen } from "./screens/ShortlistScreen";
import { api, ApiError } from "./lib/api";
import { API_URL, type DataMode } from "./lib/config";
import { presetById } from "./lib/presets";
import type { Category, Explanation, InventorySource, MatchOut, MatchRequest, ParseOut } from "./lib/types";
import {
  addToShortlist, briefChanged, deleteProject, listProjects, loadProject, newProject, removeFromShortlist,
  saveProject, storageAvailable, withEvent, type ProjectBrief, type StoredProject,
} from "./lib/project";
import { demoExplain, demoMatch, demoParse, DemoNotCovered } from "./demo/demo";

type Step = "request" | "review" | "results" | "shortlist";

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
    priority: p.priority ?? "balanced",
  };
}

function toBrief(r: ReviewedRequest): ProjectBrief {
  const loc = presetById(r.location)!;
  return {
    needs: r.needs.map((n) => ({ category: n.category, quantity: n.quantity, label: n.label.slice(0, 80) })),
    start_date: r.startDate,
    end_date: r.endDate,
    location: { preset_id: loc.id, lat: loc.lat, lon: loc.lon, label: loc.name },
    requirements: r.minCondition || r.maxDistanceKm
      ? { min_condition: r.minCondition || null, max_distance_km: r.maxDistanceKm ? Number(r.maxDistanceKm) : null }
      : null,
    priority: r.priority === "balanced" ? null : r.priority,
  };
}

function fromBrief(b: ProjectBrief): ReviewedRequest {
  return {
    needs: b.needs,
    startDate: b.start_date,
    endDate: b.end_date,
    location: b.location.preset_id,
    minCondition: b.requirements?.min_condition ?? "",
    maxDistanceKm: b.requirements?.max_distance_km ? String(b.requirements.max_distance_km) : "",
    priority: b.priority ?? "balanced",
  };
}

const projectName = (r: ReviewedRequest) =>
  `${r.needs.map((n) => `${n.quantity} ${n.label}`).join(", ")} · ${presetById(r.location)?.name.split(",")[0] ?? ""} · ${fmtDate(r.startDate)}–${fmtDate(r.endDate)}`.slice(0, 80);

export default function App() {
  // Without a configured backend (e.g. the static preview) the visible default is the demo inventory.
  const [mode, setMode] = useState<DataMode>(API_URL ? "live" : "demo");
  const [step, setStep] = useState<Step>("request");
  const [draft, setDraft] = useState<RequestDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParseOut | null>(null);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reviewed, setReviewed] = useState<ReviewedRequest | null>(null);
  const [results, setResults] = useState<NeedResult[]>([]);
  const [source, setSource] = useState<InventorySource | null>(null);
  const runId = useRef(0);
  const [showMethod, setShowMethod] = useState(false);

  // Saved project (browser-local).
  const [canSave] = useState(storageAvailable);
  const [project, setProject] = useState<StoredProject | null>(null);
  const [saved, setSaved] = useState(true);
  const [autoCheck, setAutoCheck] = useState(false);
  const [projects, setProjects] = useState(() => (canSave ? listProjects() : []));

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const persist = (s: StoredProject) => {
    setProject(s);
    setSaved(canSave && saveProject(s));
    if (canSave) setProjects(listProjects());
  };

  async function submitRequest(d: RequestDraft) {
    setDraft(d);
    setProject(null); // a new request starts a new project
    setEditing(false);
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

  /** Confirmed on the review screen: save the brief, then search. */
  function confirmBrief(r: ReviewedRequest) {
    const brief = toBrief(r);
    if (project) {
      const s = briefChanged(project, brief);
      persist({ ...s, project: { ...s.project, mode } });
    } else {
      persist(newProject(brief, mode, projectName(r)));
    }
    search(r);
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
      priority: r.priority === "balanced" ? null : r.priority,
    }));
    setReviewed(r);
    setResults(r.needs.map((need) => ({ need, status: "loading" })));
    setSource(m === "demo" ? "browser_demo" : null);
    go("results");

    const update = (i: number, patch: Partial<NeedResult>) =>
      id === runId.current && setResults((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    await Promise.all(reqs.map(async (req, i) => {
      const need = r.needs[i];
      let response;
      try {
        response = m === "demo" ? demoMatch(req) : await api.match(req);
      } catch (e) {
        update(i, {
          status: e instanceof DemoNotCovered ? "not_in_demo" : "error",
          error: e instanceof ApiError || e instanceof DemoNotCovered ? e.message : "unexpected error",
        });
        return;
      }
      update(i, { status: "ok", response, explaining: response.matches.length > 0 });
      // /match says where its data came from (live database or the offline fictional dataset).
      // Demo mode replays recorded responses, which is its own state.
      if (id === runId.current && m === "live" && response.inventory_source) setSource(response.inventory_source);
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

  function toggleShortlist(m: MatchOut, category: Category) {
    if (!project) return;
    const inList = project.project.shortlist.some((e) => e.item_id === m.item_id);
    persist(inList ? removeFromShortlist(project, m.item_id) : addToShortlist(project, m, category, source ?? mode));
  }

  function reopen(id: string) {
    const s = loadProject(id);
    if (!s) {
      setProjects(listProjects());
      return;
    }
    const reopened = { ...s, project: withEvent(s.project, "project_reopened") };
    persist(reopened);
    setMode(reopened.project.mode);
    setReviewed(fromBrief(reopened.project.brief));
    setResults([]);
    setAutoCheck(true);
    go("shortlist");
  }

  function editProjectRequest() {
    if (!project) return;
    setParsed(null);
    setParseNote(null);
    setEditing(true);
    setReviewed(fromBrief(project.project.brief));
    go("review");
  }

  const shortlistIds = new Set(project?.project.shortlist.map((e) => e.item_id) ?? []);

  return (
    <div className="app">
      <Header mode={mode} />
      {step === "request" && (
        <RequestScreen draft={draft} mode={mode} busy={busy} onModeChange={setMode} onSubmit={submitRequest}
          projects={projects.map((s) => s.project)} canSave={canSave} onReopen={reopen} />
      )}
      {step === "review" && reviewed && (
        <ReviewScreen
          key={JSON.stringify(reviewed)}
          parsed={parsed}
          parseNote={parseNote}
          editing={editing}
          initial={reviewed}
          onBack={() => go(editing && project ? "shortlist" : "request")}
          onConfirm={confirmBrief}
        />
      )}
      {step === "results" && reviewed && (
        <ResultsScreen
          results={results}
          source={source}
          placeLabel={presetById(reviewed.location)?.name ?? ""}
          dateLabel={`${fmtDate(reviewed.startDate)}–${fmtDate(reviewed.endDate)}`}
          onEdit={() => (project ? editProjectRequest() : go("review"))}
          onRetry={() => search(reviewed)}
          onShowMethod={() => setShowMethod(true)}
          onSwitchToDemo={mode === "live" ? () => {
            setMode("demo");
            search(reviewed, "demo");
          } : undefined}
          shortlistIds={shortlistIds}
          onToggleShortlist={toggleShortlist}
          onDetailsViewed={(itemId) => project && persist({ ...project, project: withEvent(project.project, "details_viewed", itemId) })}
          shortlistCount={project?.project.shortlist.length ?? 0}
          saved={saved}
          onOpenShortlist={() => {
            setAutoCheck(false);
            go("shortlist");
          }}
        />
      )}
      {step === "shortlist" && project && (
        <ShortlistScreen
          key={project.project.id}
          stored={project}
          saved={saved}
          autoCheck={autoCheck}
          onBack={() => (results.length ? go("results") : go("request"))}
          onEditRequest={editProjectRequest}
          onRemove={(itemId) => persist(removeFromShortlist(project, itemId))}
          onRename={(name) => persist({ ...project, project: { ...project.project, name: name.slice(0, 80), updated_at: new Date().toISOString() } })}
          onDelete={() => {
            if (canSave) deleteProject(project.project.id);
            setProject(null);
            setProjects(canSave ? listProjects() : []);
            setResults([]);
            go("request");
          }}
          onShowMethod={() => setShowMethod(true)}
        />
      )}
      {showMethod && <MethodologySheet mode={mode} onClose={() => setShowMethod(false)} />}
    </div>
  );
}
