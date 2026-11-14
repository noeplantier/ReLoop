import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `vite build --mode preview` inlines every asset so the app can ship as one self-contained page
// (static preview link, demo inventory only).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173 },
  build: mode === "preview" ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false } : {},
}));
