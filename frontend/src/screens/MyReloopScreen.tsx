import { useState } from "react";
import { Icon } from "../components/Icon";
import { Dialog } from "../components/Dialog";
import { EquipmentArt } from "../components/EquipmentArt";
import { BadgeArt, ConceptArt } from "../components/RewardArt";
import type { ProgressOut } from "../lib/api";
import type { StoredProject } from "../lib/project";
import { presetById } from "../lib/presets";
import { offerSummary, type Achievement, type StoredOffer } from "../lib/local";
import { downloadCard } from "../lib/card";
import { progressData, useProgress } from "../lib/useProgress";
import { BadgeShelf } from "../components/BadgeShelf";
import { logoUrl } from "../components/Brand";

interface Props {
  current: StoredProject | null;
  projects: StoredProject[];
  offers: StoredOffer[];
  achievement: Achievement | undefined;
  badges: Record<string, string>;
  profileName: string;
  initialArea: "project" | "rewards";
  onOpenProject: (id: string) => void;
  onNewRequest: () => void;
  onNewOffer: () => void;
  onEditOffer: (o: StoredOffer) => void;
  onDeleteOffer: (id: string) => void;
  onProgress: (out: ProgressOut, projectId: string) => void;
}

const fmtDay = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const CONCEPTS = [
  { kind: "tshirt" as const, title: "ReLoop T-shirt" },
  { kind: "shoes" as const, title: "ReLoop shoes" },
  { kind: "travel" as const, title: "Bali travel experience" },
];

export function MyReloopScreen(p: Props) {
  const [area, setArea] = useState<"project" | "rewards">(p.initialArea);
  const [delId, setDelId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const validOffers = p.offers.filter((o) => o.check === "valid").map((o) => o.offer);
  const prog = useProgress(p.current?.project ?? null, (out, proj) => p.onProgress(out, proj.id), validOffers);
  const progress = progressData(prog);
  const unlocked = !!p.achievement;
  const nextMs = progress?.milestones.find((m) => m.status === "incomplete");

  async function copy(o: StoredOffer) {
    const text = offerSummary(o.offer);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(o.offer.id);
    } catch {
      window.prompt("Copy this summary:", text);
    }
    setTimeout(() => setCopied(null), 2500);
  }

  async function download() {
    if (!p.achievement) return;
    setCardMsg("Preparing your card…");
    try {
      const kind = await downloadCard(p.achievement, p.profileName);
      setCardMsg(kind === "png" ? "Card downloaded (PNG)." : "Card downloaded (SVG).");
    } catch {
      setCardMsg("The card couldn’t be created in this browser.");
    }
  }

  const others = p.projects.filter((s) => s.project.id !== p.current?.project.id).slice(0, 4);

  return (
    <main className="view view--hub">
      <div className="view__head">
        <section className="hub-hero card aura" aria-labelledby="hub-h">
          <span className="ring" aria-hidden="true">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line-strong)" strokeWidth="5" />
              <circle className="ring__bar" cx="40" cy="40" r="34" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${Math.round(213.6 * (progress ? progress.points.earned / Math.max(progress.points.possible, 1) : 0))} 214`}
                transform="rotate(-90 40 40)" />
              <image href={logoUrl} x="26" y="25" width="28" height="29" />
            </svg>
          </span>
          <div className="hub-hero__text">
            <p className="eyebrow">My ReLoop</p>
            <h1 id="hub-h" className="h1">{p.profileName.trim() ? `Welcome back, ${p.profileName.trim().split(/\s+/)[0]}` : "Welcome to your ReLoop"}</h1>
            <p className="fine">{progress
              ? `${progress.milestones.filter((m) => m.status === "complete").length} of ${progress.milestones.length} reuse steps · ${progress.points.earned}/${progress.points.possible} pts (server-evaluated)`
              : p.current ? (prog.state === "unavailable" ? prog.reason : "Checking your progress…") : "Keep useful equipment in circulation: find it or share it."}</p>
            {nextMs && <p className="hub-hero__next"><span className="eyebrow">Next</span> {nextMs.title} <b>+{nextMs.points}</b></p>}
          </div>
          <div className="hub-hero__actions">
            {p.current
              ? <button className="btn btn--primary" onClick={() => p.onOpenProject(p.current!.project.id)}>Return to my project <Icon name="arrow" size={18} /></button>
              : <button className="btn btn--primary" onClick={p.onNewRequest}><Icon name="search" size={18} /> Find equipment</button>}
            {nextMs && (nextMs.id === "offer_saved" || (nextMs.id === "brief_reviewed" && p.current)) && (
              <button className="btn btn--soft btn--small" onClick={nextMs.id === "offer_saved" ? p.onNewOffer : p.onNewRequest}>
                {nextMs.id === "offer_saved" ? "Offer equipment" : "Find equipment"}
              </button>
            )}
          </div>
        </section>
        <div className="seg2" role="tablist" aria-label="My ReLoop sections">
          <button type="button" role="tab" aria-selected={area === "project"} className={area === "project" ? "is-on" : ""} onClick={() => setArea("project")}>
            <Icon name="box" size={16} /> Project & equipment
          </button>
          <button type="button" role="tab" aria-selected={area === "rewards"} className={area === "rewards" ? "is-on" : ""} onClick={() => setArea("rewards")}>
            <Icon name="gift" size={16} /> Rewards Studio
          </button>
        </div>
      </div>

      <div className="view__body hub-grid" data-area={area}>
        {/* ---------- 1. Project and equipment ---------- */}
        <section className="hub-col hub-col--project" aria-labelledby="hub-proj-h">
          <h2 id="hub-proj-h" className="h2 hub-col__title">My project & equipment</h2>
          {p.current ? (
            <div className="card card--glow">
              <p className="eyebrow">Current project</p>
              <p className="h3">{p.current.project.name}</p>
              <p className="fine">{p.current.project.shortlist.length} shortlisted · {presetById(p.current.project.brief.location.preset_id)?.name}
                {p.current.project.mode === "demo" ? " · demo" : ""}</p>

            </div>
          ) : (
            <div className="card">
              <p className="h3">No project yet</p>
              <p className="fine">Describe what your event needs and shortlist reuse options.</p>
              <button className="btn btn--primary btn--block" onClick={p.onNewRequest}><Icon name="search" size={18} /> Find equipment</button>
            </div>
          )}
          {others.length > 0 && (
            <ul className="list">
              {others.map((s) => (
                <li key={s.project.id}>
                  <button className="list__item" onClick={() => p.onOpenProject(s.project.id)}>
                    <span>{s.project.name}</span><span className="fine">{s.project.shortlist.length} shortlisted</span><Icon name="next" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="card__row">
            <h3 className="h3">My offers <span className="count">{p.offers.length}</span></h3>
            <button className="btn btn--small btn--ghost" onClick={p.onNewOffer}><Icon name="plus" size={16} /> Offer equipment</button>
          </div>
          <p className="local-label"><Icon name="info" size={16} /> Saved in this browser — not visible to others yet.</p>
          {p.offers.length === 0 && <p className="empty2">Share what you have: one offer is enough to start.</p>}
          <ul className="offers">
            {p.offers.map((s) => (
              <li key={s.offer.id} className="offer-row">
                <div className="offer-row__art"><EquipmentArt category={s.offer.category} label={false} /></div>
                <div className="offer-row__main">
                  <p className="offer-row__name">{s.offer.quantity} × {s.offer.label}</p>
                  <p className="fine">{s.offer.condition} · {fmtDay(s.offer.available_from)}–{fmtDay(s.offer.available_to)} · {presetById(s.offer.location.preset_id)?.name}</p>
                  <p className={`status ${s.check === "valid" ? "is-ok" : "is-warn"}`}>
                    <Icon name={s.check === "valid" ? "check" : "info"} size={14} /> {s.check === "valid" ? "Checked by the ReLoop server" : "Not checked yet (server unreachable)"}
                  </p>
                </div>
                <div className="offer-row__actions">
                  <button className="icon-btn" aria-label={`Copy a summary of ${s.offer.label}`} onClick={() => copy(s)}><Icon name={copied === s.offer.id ? "check" : "copy"} size={18} /></button>
                  <button className="icon-btn" aria-label={`Edit ${s.offer.label}`} onClick={() => p.onEditOffer(s)}><Icon name="edit" size={18} /></button>
                  <button className="icon-btn" aria-label={`Delete ${s.offer.label}`} onClick={() => setDelId(s.offer.id)}><Icon name="trash" size={18} /></button>
                </div>
              </li>
            ))}
          </ul>
          {copied && <p className="sr-only" role="status">Summary copied.</p>}
        </section>

        {/* ---------- 2. Progress and Rewards Studio ---------- */}
        <section className="hub-col hub-col--rewards" aria-labelledby="hub-rew-h">
          <h2 id="hub-rew-h" className="h2 hub-col__title">Progress & Rewards Studio</h2>
          <div className={`reward-hero card ${unlocked ? "card--glow" : ""}`}>
            <BadgeArt unlocked={unlocked} size={104} />
            <div>
              <p className="eyebrow">{unlocked ? "Unlocked · digital badge" : "Your first reward"}</p>
              <p className="h3">Reuse Starter</p>
              <p className="fine">{unlocked
                ? `Earned ${new Date(p.achievement!.unlocked_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by ${p.achievement!.via === "offer" ? "offering equipment" : "confirming a request"}.`
                : "Unlocks when you confirm one request or save one valid offer. Full coverage isn’t required."}</p>
              {unlocked
                ? <button className="btn btn--primary btn--small" onClick={download}><Icon name="download" size={16} /> Download card</button>
                : <button className="btn btn--primary btn--small" onClick={p.onNewOffer}>Offer one item</button>}
              {cardMsg && <p className="fine" role="status">{cardMsg}</p>}
            </div>
          </div>
          <p className="fine">Participation badge: no monetary value, not proof of an exchange or of carbon saved.</p>

          <div className="card">
            <div className="card__row">
              <h3 className="h3">Badges</h3>
              <span className="count">{Object.keys(p.badges).length + (unlocked ? 1 : 0)} earned</span>
            </div>
            <BadgeShelf achievement={p.achievement} badges={p.badges} profileName={p.profileName} />
          </div>

          <div className="card">
            <div className="card__row">
              <h3 className="h3">Reuse steps</h3>
              {progress && <span className="count">{progress.points.earned}/{progress.points.possible} pts</span>}
            </div>
            {!p.current && <p className="fine">Start a request to track project milestones.</p>}
            {p.current && prog.state === "loading" && !progress && <p className="fine">Checking with the server…</p>}
            {p.current && prog.state === "unavailable" && <p className="fine">{prog.reason}</p>}
            {progress && (
              <>

                <ul className="ms2">
                  {progress.milestones.map((m) => (
                    <li key={m.id} className={m.status === "complete" ? "is-done" : ""} title={m.eligibility}>
                      <Icon name={m.status === "complete" ? "check" : "plus"} size={14} /> {m.title}
                      <span className="sr-only">{m.status === "complete" ? " (done)" : " (not yet)"}</span>
                    </li>
                  ))}
                </ul>
                <p className="fine">{progress.points.note} Same project, same result: refreshing never adds points.</p>
              </>
            )}
          </div>

          <h3 className="h3">Future reward concepts</h3>
          <div className="concepts">
            {CONCEPTS.map((c) => (
              <article key={c.kind} className="concept">
                <ConceptArt kind={c.kind} />
                <p className="concept__title">{c.title}</p>
                <p className="concept__state">Future reward concept — unavailable</p>
              </article>
            ))}
          </div>
          <p className="fine">Ideas we’re exploring. Nobody can win, claim or buy them; no partner, product or trip exists.</p>
        </section>
      </div>

      {delId && (
        <Dialog title="Delete this offer?" onClose={() => setDelId(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setDelId(null)} data-autofocus>Cancel</button>
            <button className="btn btn--danger" onClick={() => {
              p.onDeleteOffer(delId);
              setDelId(null);
            }}>Delete</button>
          </>}>
          <p>It’s removed from this browser. This can’t be undone.</p>
        </Dialog>
      )}
    </main>
  );
}
