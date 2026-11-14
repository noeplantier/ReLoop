// Where data comes from. Demo mode is only ever entered explicitly by the user.
export type DataMode = "live" | "demo";

export const API_URL: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || undefined;

export const MAX_TEXT_CHARS = 1000; // same cap as the backend (ai/schemas.py)
