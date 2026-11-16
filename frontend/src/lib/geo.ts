// "Use my location": asked only after the user presses the button. The exact position is used once, in
// memory, to pick the nearest DEMO area, and is never stored, sent or shown. The demo inventory only covers
// the Antalya area, so a position far from it is reported as such instead of inventing nearby equipment.
import { PRESETS, type Preset } from "./presets";

export const DEMO_RADIUS_KM = 60;

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type LocateResult =
  | { ok: true; preset: Preset }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "outside_demo" };

export function locateNearestPreset(): Promise<LocateResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ ok: false, reason: "unsupported" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best: Preset | null = null, bestKm = Infinity;
        for (const p of PRESETS) {
          const d = km(latitude, longitude, p.lat, p.lon);
          if (d < bestKm) [best, bestKm] = [p, d];
        }
        resolve(best && bestKm <= DEMO_RADIUS_KM ? { ok: true, preset: best } : { ok: false, reason: "outside_demo" });
      },
      (err) => resolve({ ok: false, reason: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });
}

export const LOCATE_TEXT: Record<Exclude<LocateResult, { ok: true }>["reason"], string> = {
  unsupported: "This browser can’t share a location. Choose an area instead.",
  denied: "Location permission was not given. Choose an area instead.",
  unavailable: "Your location couldn’t be found right now. Choose an area instead.",
  outside_demo: "You seem to be outside the demo area. The fictional inventory only covers Antalya, so choose a demo area to try it.",
};
