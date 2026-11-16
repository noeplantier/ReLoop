import { useState } from "react";
import { Icon } from "../components/Icon";
import { Dialog } from "../components/Dialog";
import { AreaPicker } from "../components/AreaPicker";
import { BadgeArt } from "../components/RewardArt";
import { presetById } from "../lib/presets";
import { initials, type Achievement, type Profile } from "../lib/local";

export function ProfileScreen({ profile, onSave, projectCount, offerCount, achievement, badgeCount = 0, onOpenHub, onReset, canSave }: {
  badgeCount?: number;
  profile: Profile;
  onSave: (p: Profile) => void;
  projectCount: number;
  offerCount: number;
  achievement: Achievement | undefined;
  onOpenHub: () => void;
  onReset: (alsoProjects: boolean) => void;
  canSave: boolean;
}) {
  const [name, setName] = useState(profile.name);
  const [area, setArea] = useState(profile.area);
  const [via, setVia] = useState(profile.areaVia);
  const [savedMsg, setSavedMsg] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [alsoProjects, setAlsoProjects] = useState(false);
  const dirty = name.trim() !== profile.name || area !== profile.area;
  const ini = initials(name) || "";

  return (
    <main className="view view--profile">
      <div className="view__head">
        <h1 className="h1">Profile on this device</h1>
        <p className="local-label"><Icon name="info" size={16} /> Stored only in this browser. Not an account: no sign-in, no cloud sync, no other devices.</p>
      </div>
      <div className="view__body profile-grid">
        <form className="card aura" onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim().slice(0, 40), area, areaVia: area ? via || "manual" : "" });
          setSavedMsg(true);
          setTimeout(() => setSavedMsg(false), 2500);
        }}>
          <div className="profile-id">
            <span className="avatar avatar--lg" aria-hidden="true">{ini || <Icon name="user" size={30} />}</span>
            <div className="field grow">
              <label className="field__label" htmlFor="pf-name">Display name</label>
              <input id="pf-name" className="input" maxLength={40} value={name} placeholder="e.g. Deniz" autoComplete="nickname"
                onChange={(e) => setName(e.target.value)} />
              <p className="field__note">Shown on your achievement card. Optional.</p>
            </div>
          </div>
          <AreaPicker value={area} onChange={(v, how) => {
            setArea(v);
            setVia(how);
          }} label="Preferred area" />
          <p className="field__note">Used to pre-fill requests and offers. {area && via === "approx_location" ? "Picked from your approximate location; the exact position wasn’t kept." : ""}</p>
          <div className="row-actions">
            <button className="btn btn--primary" type="submit" disabled={!dirty || !canSave}>Save profile</button>
            {savedMsg && <span className="fine" role="status"><Icon name="check" size={14} /> Saved on this device</span>}
            {!canSave && <span className="field__note field__note--warn">This browser blocks saving.</span>}
          </div>
        </form>

        <div className="stack">
          <section className="card">
            <h2 className="h3">On this device</h2>
            <ul className="stats">
              <li><b>{projectCount}</b><span>saved project{projectCount === 1 ? "" : "s"}</span></li>
              <li><b>{offerCount}</b><span>offer{offerCount === 1 ? "" : "s"} (not public)</span></li>
              <li><b>{(achievement ? 1 : 0) + badgeCount}</b><span>digital badges</span></li>
            </ul>
            {profile.area && <p className="fine">Preferred area: {presetById(profile.area)?.name}</p>}
            <button className="btn btn--ghost btn--block" onClick={onOpenHub}>Open My ReLoop <Icon name="arrow" size={18} /></button>
          </section>
          <section className="card reward-mini">
            <BadgeArt unlocked={!!achievement} size={56} />
            <div>
              <p className="h3">Reuse Starter</p>
              <p className="fine">{achievement ? "Unlocked · digital badge" : "Locked · confirm a request or save an offer"}</p>
            </div>
          </section>
          <button className="btn btn--small btn--ghost danger" onClick={() => setResetOpen(true)}><Icon name="trash" size={16} /> Reset this device</button>
        </div>
      </div>

      {resetOpen && (
        <Dialog title="Reset ReLoop on this device?" onClose={() => setResetOpen(false)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setResetOpen(false)} data-autofocus>Cancel</button>
            <button className="btn btn--danger" onClick={() => {
              onReset(alsoProjects);
              setResetOpen(false);
              setName("");
              setArea("");
            }}>Reset</button>
          </>}>
          <p>This deletes your profile, offers and digital badges from this browser. It can’t be undone.</p>
          <label className="check">
            <input type="checkbox" checked={alsoProjects} onChange={(e) => setAlsoProjects(e.target.checked)} />
            Also delete saved projects ({projectCount})
          </label>
        </Dialog>
      )}
    </main>
  );
}
