// Demo fixtures: keep the web copy identical to the backend's, and make sure every demo example works.
//   npm run sync:fixtures   copy backend/fixtures/demo_scenarios.json into src/demo/
//   npm run check:fixtures  fail if the copy differs, or if a demo example has no recorded result
import { build } from "esbuild";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../../backend/fixtures/demo_scenarios.json");
const dst = join(here, "../src/demo/demo_scenarios.json");

if (process.argv[2] === "sync") {
  copyFileSync(src, dst);
  console.log("Copied backend/fixtures/demo_scenarios.json -> src/demo/demo_scenarios.json");
  process.exit(0);
}

let fails = 0;
const same = JSON.stringify(JSON.parse(readFileSync(src, "utf8"))) === JSON.stringify(JSON.parse(readFileSync(dst, "utf8")));
console.log(same ? "OK   fixture copy matches the backend" : "FAIL fixture copy differs: run npm run sync:fixtures");
if (!same) fails++;

const dir = mkdtempSync(join(tmpdir(), "reloop-fx-"));
const out = join(dir, "demo.mjs");
await build({ entryPoints: [join(here, "../src/demo/demo.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "error" });
const demo = await import(pathToFileURL(out).href);
const presets = JSON.parse(readFileSync(dst, "utf8")).meta.presets;

for (const ex of demo.DEMO_EXAMPLES) {
  const p = demo.demoParse(ex.text, ex.startDate, ex.endDate, ex.location);
  try {
    if (!p.needs.length) throw new Error("no equipment read from the text");
    for (const n of p.needs) {
      const r = demo.demoMatch({
        category: n.category, quantity: n.quantity, start_date: p.start_date, end_date: p.end_date,
        location: presets[ex.location],
        requirements: p.requirements.min_condition || p.requirements.max_distance_km ? p.requirements : null,
        priority: p.priority && p.priority !== "balanced" ? p.priority : null,
      });
      if (!r) throw new Error("no response");
    }
    console.log(`OK   example "${ex.title}"`);
  } catch (e) {
    fails++;
    console.log(`FAIL example "${ex.title}": ${e.message}`);
  }
}
rmSync(dir, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
