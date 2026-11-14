// Labelled demo locations. Same list and coordinates as ai/presets.py. No geocoding.
export type PresetId = "lara" | "konyaalti" | "kepez" | "belek" | "kemer" | "antalya";

export interface Preset {
  id: PresetId;
  name: string;
  lat: number;
  lon: number;
}

export const PRESETS: Preset[] = [
  { id: "lara", name: "Lara, Antalya", lat: 36.853, lon: 30.8 },
  { id: "konyaalti", name: "Konyaalti, Antalya", lat: 36.88, lon: 30.64 },
  { id: "kepez", name: "Kepez, Antalya", lat: 36.93, lon: 30.7 },
  { id: "belek", name: "Belek, Serik", lat: 36.86, lon: 31.05 },
  { id: "kemer", name: "Kemer, Antalya", lat: 36.6, lon: 30.56 },
  { id: "antalya", name: "Antalya city centre (approx.)", lat: 36.8969, lon: 30.7133 },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

// Noé's main demo scenario.
export const DEMO_REQUEST = {
  text: "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026.",
  startDate: "2026-11-21",
  endDate: "2026-11-23",
  location: "lara" as PresetId,
};
