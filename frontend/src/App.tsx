import { useEffect, useRef, useState } from "react";
import { Header, type Area } from "./components/Header";
import { MethodologySheet } from "./components/MethodologySheet";
import { Dialog } from "./components/Dialog";
import { OfferFlow } from "./components/OfferFlow";
import { BadgeArt } from "./components/RewardArt";
import { Icon } from "./components/Icon";
import { RequestScreen, type RequestDraft } from "./screens/RequestScreen";
import { ReviewScreen, type ReviewedRequest } from "./screens/ReviewScreen";
import { ResultsScreen, type NeedResult } from "./screens/ResultsScreen";
import { ShortlistScreen } from "./screens/ShortlistScreen";
import { MyReloopScreen } from "./screens/MyReloopScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { api, ApiError, type ProgressOut } from "./lib/api";
import { API_URL, type DataMode } from "./lib/config";
import { presetById } from "./lib/presets";
import type { Category, Explanation, InventorySource, MatchOut, MatchRequest, ParseOut, Priority } from "./lib/types";
import {
  addToShortlist, briefChanged, deleteProject, listProjects, loadProject, newProject, removeFromShortlist,
  saveProject, storageAvailable, withEvent, type ProjectBrief, type StoredProject,
} from "./lib/project";
import {
  deleteOffer, initials, listOffers, loadAchievements, loadProfile, markAchievementSeen, MAX_OFFERS, recordAchievement,
  resetLocal, saveProfile, upsertOffer, type Achievement, type Offer, type Profile, type StoredOffer,
} from "./lib/local";
import { demoExplain, demoMatch, demoParse, DemoNotCovered } from "./demo/demo";

type View = "home" | "review" | "results" | "project" | "hub" | "profile";

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

const AREA_OF: Record<View, Area | null> = { home: "home", review: "home", results: "home", project: "hub", hub: "hub", profile: "profile" };

export default function App() {
  // Without a configured backend (e.g. the static preview) the visible default is the demo inventory.
  const [mode, setMode] = useState<DataMode>(API_URL ? "live" : "demo");
  const [view, setView] = useState<View>("home");
  const [homeTab, setHomeTab] = useState<"find" | "offer">("find");
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [draft, setDraft] = useState<RequestDraft>(() => ({ text: "", startDate: "", endDate: "", location: loadProfile().area }));
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParseOut | null>(null);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reviewed, setReviewed] = useState<ReviewedRequest | null>(null);
  const [results, setResults] = useState<NeedResult[]>([]);
  const [source, setSource] = useState<InventorySource | null>(null);
  const runId = useRef(0);
  const [showMethod, setShowMethod] = useState(false);
  const [hubArea, setHubArea] = useState<"project" | "rewards">("project");

  // Saved project (browser-local).
  const [canSave] = useState(storageAvailable);
  const [project, setProject] = useState<StoredProject | null>(null);
  const [saved, setSaved] = useState(true);
  const [autoCheck, setAutoCheck] = useState(false);
  const [projects, setProjects] = useState(() => (canSave ? listProjects() : []));

  // Offers and achievements (browser-local, see lib/local.ts).
  const [offers, setOffers] = useState<StoredOffer[]>(listOffers);
  const [editOffer, setEditOffer] = useState<StoredOffer | null>(null);
  const [achievements, setAchievements] = useState(loadAchievements);
  const starter = achievements.reuse_starter;
  const [congrats, setCongrats] = useState(() => !!loadAchievements().reuse_starter && !loadAchievements().reuse_starter!.seen);
  const mainRef = useRef<HTMLDivElement>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const go = (v: View) => {
    setView(v);
    mainRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => mainRef.current?.querySelector<HTMLElement>("h1, [role=tablist]")?.focus?.({ preventScroll: true }));
  };
  const navigate = (a: Area) => {
    if (a === "hub") setHubArea("project");
    go(a === "home" ? "home" : a);
  };

  const persist = (s: StoredProject) => {
    setProject(s);
    setSaved(canSave && saveProject(s));
    if (canSave) setProjects(listProjects());
  };

  /** Server said the badge is unlocked: record the FIRST unlock only (never re-awarded, never counted twice). */
  const achRef = useRef(achievements);
  achRef.current = achievements;
  function unlocked(via: Achievement["via"], rules: string) {
    if (achRef.current.reuse_starter) return; // already earned: nothing changes, nothing is shown again
    const r = recordAchievement({ id: "reuse_starter", via, rules_version: rules });
    // If the browser blocks storage, keep it for this session only.
    const next = { ...loadAchievements() };
    if (!next.reuse_starter) next.reuse_starter = r.achievement;
    achRef.current = next;
    setAchievements(next);
    if (r.isNew) setCongrats(true);
  }
  const dismissCongrats = () => {
    markAchievementSeen("reuse_starter");
    setAchievements((a) => (a.reuse_starter ? { ...a, reuse_starter: { ...a.reuse_starter, seen: true } } : a));
    setCongrats(false);
  };
  const onProgress = (out: ProgressOut) => {
    if (out.rewards.some((r) => r.id === "reuse_starter" && r.status === "unlocked")) unlocked("request", out.rules_version);
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

  /** Confirmed on the review screen: save the brief, ask the server about progress, then search. */
  function confirmBrief(r: ReviewedRequest) {
    const brief = toBrief(r);
    let s: StoredProject;
    if (project) {
      const c = briefChanged(project, brief);
      s = { ...c, project: { ...c.project, mode } };
    } else {
      s = newProject(brief, mode, projectName(r));
    }
    persist(s);
    // First participation needs no matches: the server derives it from the confirmed brief alone.
    if (API_URL) api.progress(s.project, listOffers().filter((o) => o.check === "valid").map((o) => o.offer)).then(onProgress).catch(() => undefined);
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
        if (m === "live" && navigator.onLine === false) throw new ApiError("You’re offline.", "network");
        response = m === "demo" ? demoMatch(req) : await api.match(req);
      } catch (e) {
        update(i, {
          status: e instanceof DemoNotCovered ? "not_in_demo" : "error",
          error: e instanceof ApiError || e instanceof DemoNotCovered ? e.message : "unexpected error",
        });
        return;
      }
      update(i, { status: "ok", response, explaining: response.matches.length > 0 });
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
          exps = demoExplain(req, need, response.matches).explanations;
          explainNote = "AI unavailable";
        }
      }
      update(i, { explaining: false, explainNote, explanations: Object.fromEntries(exps.map((x) => [x.item_id, x])) });
    }));
  }

  /** Ranking changes go back through the engine (never re-sorted in the browser). */
  function changePriority(pr: Priority) {
    if (!reviewed) return;
    const r = { ...reviewed, priority: pr };
    if (project) persist(briefChanged(project, toBrief(r)));
    search(r);
  }

  function toggleShortlist(m: MatchOut, category: Category) {
    if (!project) return;
    const inList = project.project.shortlist.some((e) => e.item_id === m.item_id);
    persist(inList ? removeFromShortlist(project, m.item_id) : addToShortlist(project, m, category, source ?? mode));
  }

  function reopen(id: string) {
    if (project?.project.id === id) {
      setAutoCheck(false);
      return go("project");
    }
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
    go("project");
  }

  function editProjectRequest() {
    if (!project) return;
    setParsed(null);
    setParseNote(null);
    setEditing(true);
    setReviewed(fromBrief(project.project.brief));
    go("review");
  }

  /* ---------- offers ---------- */

  async function saveOffer(o: Offer): Promise<{ error: string | null; checked: boolean }> {
    let check: StoredOffer["check"] = "unchecked";
    let final = o;
    let area: string | undefined;
    let rules = "";
    if (API_URL && navigator.onLine !== false) {
      try {
        const r = await api.offerValidate(o);
        final = { ...o, ...r.offer };
        area = r.approx_location.label;
        check = "valid";
        rules = "offer/validate";
      } catch (e) {
        // The server rejected the offer itself: show why and save nothing.
        if (e instanceof ApiError && e.kind === "http" && e.status === 422) return { error: e.message, checked: false };
        // Server unreachable or busy: keep the offer locally, unchecked; re-checked later. No reward yet.
      }
    }
    if (!upsertOffer({ offer: final, updated_at: new Date().toISOString(), check, area_label: area })) {
      return { error: "This browser blocks saving, so the offer couldn’t be kept.", checked: false };
    }
    setOffers(listOffers());
    if (check === "valid") unlocked("offer", rules);
    return { error: null, checked: check === "valid" };
  }

  // Offers saved while the server was unreachable are checked again when My ReLoop opens.
  useEffect(() => {
    if (view !== "hub" || !API_URL) return;
    const pending = listOffers().filter((s) => s.check === "unchecked");
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const s of pending) {
        try {
          const r = await api.offerValidate(s.offer);
          if (cancelled) return;
          upsertOffer({ ...s, offer: { ...s.offer, ...r.offer }, check: "valid", area_label: r.approx_location.label });
          unlocked("offer", "offer/validate");
        } catch {
          /* still unreachable or invalid: stays unchecked */
        }
      }
      if (!cancelled) setOffers(listOffers());
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const validOffers = offers.filter((o) => o.check === "valid").map((o) => o.offer);
  const shortlistIds = new Set(project?.project.shortlist.map((e) => e.item_id) ?? []);
  const currentForHub = project ?? projects[0] ?? null;

  const offerPanel = (
    <OfferFlow defaultArea={profile.area} onSave={(o) => saveOffer(o)} rewardUnlocked={!!starter}
      onViewReward={() => {
        setHubArea("rewards");
        go("hub");
      }}
      onManage={() => {
        setHubArea("project");
        go("hub");
      }} offerCount={offers.length} max={MAX_OFFERS} />
  );

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <Header mode={mode} area={AREA_OF[view]} onNavigate={navigate} initials={initials(profile.name)} rewardDot={!!starter && !starter.seen} />
      <div className="shell__main" id="main" ref={mainRef}>
        {!online && (
          <p className="offline" role="status">
            You’re offline. Saved projects, offers and your badge are still here; searches and checks will work again when you reconnect.
          </p>
        )}
        {view === "home" && (
          <RequestScreen draft={draft} onDraftChange={setDraft} mode={mode} busy={busy} onModeChange={setMode} onSubmit={submitRequest}
            projects={projects.map((s) => s.project)} canSave={canSave} onReopen={reopen}
            tab={homeTab} onTab={setHomeTab} offerPanel={offerPanel} />
        )}
        {view === "review" && reviewed && (
          <ReviewScreen
            key={JSON.stringify(reviewed)}
            parsed={parsed}
            parseNote={parseNote}
            editing={editing}
            initial={reviewed}
            onBack={() => go(editing && project ? "project" : "home")}
            onConfirm={confirmBrief}
          />
        )}
        {view === "results" && reviewed && (
          <ResultsScreen
            results={results}
            source={source}
            placeLabel={presetById(reviewed.location)?.name ?? ""}
            dateLabel={`${fmtDate(reviewed.startDate)}–${fmtDate(reviewed.endDate)}`}
            priority={reviewed.priority}
            onPriority={changePriority}
            canRerank={mode === "live"}
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
              go("project");
            }}
          />
        )}
        {view === "project" && project && (
          <ShortlistScreen
            key={project.project.id}
            stored={project}
            saved={saved}
            autoCheck={autoCheck}
            onBack={() => (results.length ? go("results") : go("hub"))}
            onFindMore={() => (results.length ? go("results") : search(fromBrief(project.project.brief), project.project.mode))}
            onEditRequest={editProjectRequest}
            onRemove={(itemId) => persist(removeFromShortlist(project, itemId))}
            onRename={(name) => persist({ ...project, project: { ...project.project, name: name.slice(0, 80), updated_at: new Date().toISOString() } })}
            onDelete={() => {
              if (canSave) deleteProject(project.project.id);
              setProject(null);
              setProjects(canSave ? listProjects() : []);
              setResults([]);
              go("hub");
            }}
            onShowMethod={() => setShowMethod(true)}
            onProgress={onProgress}
            offers={validOffers}
            onOpenHub={() => {
              setHubArea("rewards");
              go("hub");
            }}
          />
        )}
        {view === "project" && !project && (
          <main className="view"><div className="view__body"><p className="empty2">This project is no longer in this browser.</p>
            <button className="btn btn--primary" onClick={() => go("hub")}>Open My ReLoop</button></div></main>
        )}
        {view === "hub" && (
          <MyReloopScreen
            key={hubArea}
            current={currentForHub}
            projects={projects}
            offers={offers}
            achievement={starter}
            profileName={profile.name}
            initialArea={hubArea}
            onOpenProject={reopen}
            onNewRequest={() => {
              setHomeTab("find");
              go("home");
            }}
            onNewOffer={() => {
              setHomeTab("offer");
              go("home");
            }}
            onEditOffer={setEditOffer}
            onDeleteOffer={(id) => {
              deleteOffer(id);
              setOffers(listOffers());
            }}
            onProgress={onProgress}
          />
        )}
        {view === "profile" && (
          <ProfileScreen profile={profile} canSave={canSave}
            onSave={(p) => {
              saveProfile(p);
              setProfile(p);
              setDraft((d) => (d.location ? d : { ...d, location: p.area }));
            }}
            projectCount={projects.length} offerCount={offers.length} achievement={starter}
            onOpenHub={() => go("hub")}
            onReset={(alsoProjects) => {
              resetLocal();
              if (alsoProjects) {
                for (const s of listProjects()) deleteProject(s.project.id);
                setProjects([]);
                setProject(null);
                setResults([]);
              }
              setProfile(loadProfile());
              setOffers([]);
              setAchievements({});
            }} />
        )}
      </div>

      {editOffer && (
        <Dialog title="Edit offer" onClose={() => setEditOffer(null)} eyebrow="Saved in this browser — not visible to others yet">
          <OfferFlow editing={editOffer} defaultArea={profile.area} onSave={(o) => saveOffer(o)} rewardUnlocked={false}
            onViewReward={() => undefined} onManage={() => setEditOffer(null)} onDone={() => setEditOffer(null)}
            offerCount={offers.length} max={MAX_OFFERS} />
        </Dialog>
      )}

      {congrats && starter && (
        <Dialog title="You’ve earned the Reuse Starter badge" eyebrow="Digital reward unlocked" onClose={dismissCongrats} footer={<>
          <button className="btn btn--ghost" onClick={dismissCongrats}>Later</button>
          <button className="btn btn--primary" data-autofocus onClick={() => {
            dismissCongrats();
            setHubArea("rewards");
            go("hub");
          }}><Icon name="gift" size={18} /> View my reward</button>
        </>}>
          <div className="reveal">
            <BadgeArt unlocked size={132} />
            <p>{starter.via === "offer" ? "Thanks for sharing what you have." : "Thanks for looking for an alternative to buying new."} Your digital badge and a downloadable card are in My ReLoop.</p>
            <p className="fine">A participation badge: no monetary value, and not proof of an exchange or of carbon saved.</p>
          </div>
        </Dialog>
      )}

      {showMethod && <MethodologySheet mode={mode} onClose={() => setShowMethod(false)} />}
    </div>
  );
}
