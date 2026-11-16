import { useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { logoUrl } from "./Brand";
import { BADGES } from "../lib/badges";
import { downloadCard } from "../lib/card";
import type { Achievement } from "../lib/local";

type IconName = Parameters<typeof Icon>[0]["name"];

/** All digital badges: the Reuse Starter (server reward) first, then the milestone/offer badges. */
export const ALL_BADGES: { id: string; title: string; rule: string; icon: IconName }[] = [
  { id: "reuse_starter", title: "Reuse Starter", rule: "Confirm one request or save one valid offer.", icon: "loop" },
  ...BADGES.map((b) => ({
    id: b.id, title: b.title, rule: b.rule,
    icon: ({ comparer: "search", full_cover: "check", local_hero: "pin", loop_back: "back", sharer: "box", generous: "gift" } as Record<string, IconName>)[b.id] ?? "sparkle",
  })),
];

/** ReLoop-branded badge medal: brand ring, the real logo mark, and a small motif chip. */
export function BadgeMedal({ unlocked, icon, size = 64 }: { unlocked: boolean; icon: IconName; size?: number }) {
  return (
    <span className={`medal ${unlocked ? "is-on" : "is-locked"}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id="medal-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" />
            <stop offset="1" stopColor="var(--mint)" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="29" fill="none" stroke={unlocked ? "url(#medal-g)" : "var(--line-strong)"} strokeWidth="3"
          strokeDasharray={unlocked ? undefined : "3 5"} />
        <circle cx="32" cy="32" r="22" fill="var(--surface)" stroke={unlocked ? "var(--brand-a35)" : "var(--line)"} />
        <image href={logoUrl} x="21" y="20" width="22" height="23" opacity={unlocked ? 1 : 0.3} />
      </svg>
      <span className="medal__chip"><Icon name={unlocked ? icon : "plus"} size={Math.round(size / 5)} /></span>
    </span>
  );
}

export function BadgeShelf({ achievement, badges, profileName, compact }: {
  achievement: Achievement | undefined;
  badges: Record<string, string>;
  profileName: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const dateOf = (id: string) => (id === "reuse_starter" ? achievement?.unlocked_at : badges[id]);
  const list = compact ? ALL_BADGES.filter((b) => dateOf(b.id)) : ALL_BADGES;
  const sel = ALL_BADGES.find((b) => b.id === open);
  const selDate = sel ? dateOf(sel.id) : undefined;

  return (
    <>
      {compact && !list.length && <p className="fine">No badge yet. Confirm a request or save an offer to earn the first one.</p>}
      <ul className="shelf">
        {list.map((b) => {
          const on = !!dateOf(b.id);
          return (
            <li key={b.id}>
              <button type="button" className={`shelf__item ${on ? "is-on" : ""}`} onClick={() => {
                setMsg(null);
                setOpen(b.id);
              }} aria-label={`${b.title}: ${on ? "earned" : "locked"}. Show details`}>
                <BadgeMedal unlocked={on} icon={b.icon} size={compact ? 48 : 56} />
                <span className="shelf__title">{b.title}</span>
                {!compact && <span className="shelf__state">{on ? "Earned" : "Locked"}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {sel && (
        <Dialog eyebrow={selDate ? "Digital badge · earned" : "Digital badge · locked"} title={sel.title} onClose={() => setOpen(null)}
          footer={sel.id === "reuse_starter" && achievement ? (
            <button className="btn btn--primary" onClick={async () => {
              setMsg("Preparing your card…");
              try {
                setMsg((await downloadCard(achievement, profileName)) === "png" ? "Card downloaded (PNG)." : "Card downloaded (SVG).");
              } catch {
                setMsg("The card couldn’t be created in this browser.");
              }
            }}><Icon name="download" size={18} /> Download card</button>
          ) : undefined}>
          <div className="reveal">
            <BadgeMedal unlocked={!!selDate} icon={sel.icon} size={112} />
            <p><b>{selDate ? "Why you earned it" : "How to earn it"}:</b> {sel.rule}</p>
            {selDate && <p className="fine">Earned {new Date(selDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, recorded in this browser.</p>}
            <p className="fine">Digital badge with no monetary value. Not proof of an exchange or of carbon saved.</p>
            {msg && <p className="fine" role="status">{msg}</p>}
          </div>
        </Dialog>
      )}
    </>
  );
}
