import { useEffect, useState } from "react";
import { api, ApiError, type ProgressOut } from "./api";
import { API_URL } from "./config";
import type { ReloopProject } from "./project";
import type { Offer } from "./local";

export type ProgressState =
  | { state: "idle" }
  | { state: "loading"; last: ProgressOut | null }
  | { state: "ok"; data: ProgressOut }
  | { state: "unavailable"; reason: string; last: ProgressOut | null };

export const progressData = (p: ProgressState) =>
  p.state === "ok" ? p.data : p.state === "loading" || p.state === "unavailable" ? p.last : null;

/**
 * Server-evaluated progress for a project (POST /progress/evaluate). Deterministic on the server: the browser never
 * computes points, so refreshing or reopening cannot inflate them. Debounced; re-run only when the substance changes.
 */
export function useProgress(project: ReloopProject | null, onResult?: (out: ProgressOut, p: ReloopProject) => void, offers: Offer[] = []): ProgressState {
  const [st, setSt] = useState<ProgressState>({ state: "idle" });
  const key = project
    ? JSON.stringify([project.id, project.brief, project.brief_confirmed_at, project.shortlist.map((e) => [e.item_id, e.quantity]), project.events.length, project.mode, offers.map((o) => o.id)])
    : "";
  useEffect(() => {
    if (!project) return setSt({ state: "idle" });
    if (!API_URL) {
      return setSt({ state: "unavailable", last: null, reason: "Progress and rewards are checked by the ReLoop server, which isn’t connected in this preview." });
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return setSt((s) => ({ state: "unavailable", last: progressData(s), reason: "You’re offline. Progress will update when you reconnect." }));
    }
    let cancelled = false;
    setSt((s) => ({ state: "loading", last: progressData(s) }));
    const t = setTimeout(async () => {
      try {
        const out = await api.progress(project, offers);
        if (cancelled) return;
        setSt({ state: "ok", data: out });
        onResult?.(out, project);
      } catch (e) {
        if (cancelled) return;
        setSt((s) => ({
          state: "unavailable", last: progressData(s),
          reason: e instanceof ApiError && e.status === 404
            ? "Progress isn’t available on this server yet."
            : `Couldn’t load progress: ${e instanceof ApiError ? e.message : "unexpected error"}`,
        }));
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return st;
}
