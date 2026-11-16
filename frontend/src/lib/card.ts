// Downloadable achievement card, drawn in the browser from fixed strings plus the (escaped) display name.
// It states what the badge is and is not: participation, no exchange verified, no monetary value.
import { logoUrl } from "../components/Brand";
import type { Achievement } from "./local";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function logoDataUri(): Promise<string> {
  const blob = await (await fetch(logoUrl)).blob();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

export async function cardSvg(a: Achievement, name: string): Promise<string> {
  const logo = await logoDataUri();
  const date = new Date(a.unlocked_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const via = a.via === "offer" ? "Started by offering equipment" : "Started with a confirmed equipment request";
  const who = name.trim() ? esc(name.trim().slice(0, 40)) : "A ReLoop participant";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<radialGradient id="g" cx="0.78" cy="0.3" r="0.7"><stop offset="0" stop-color="#0AB567" stop-opacity="0.35"/><stop offset="1" stop-color="#0AB567" stop-opacity="0"/></radialGradient>
<linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0AB567"/><stop offset="1" stop-color="#5EF0B2"/></linearGradient>
</defs>
<rect width="1200" height="630" fill="#0B1828"/>
<rect width="1200" height="630" fill="url(#g)"/>
<rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#0AB567" stroke-opacity="0.45" stroke-width="2"/>
<g transform="translate(930 300)">
<circle r="190" fill="none" stroke="#FBFDFC" stroke-opacity="0.08" stroke-width="2"/>
<circle r="190" fill="none" stroke="url(#r)" stroke-width="6" stroke-dasharray="700 494" stroke-linecap="round" transform="rotate(-90)"/>
<circle r="140" fill="#11243A" stroke="#0AB567" stroke-opacity="0.5" stroke-width="2"/>
<image href="${logo}" xlink:href="${logo}" x="-70" y="-73" width="140" height="146"/>
</g>
<image href="${logo}" xlink:href="${logo}" x="80" y="78" width="54" height="56"/>
<text x="150" y="118" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#FBFDFC">ReLoop</text>
<text x="80" y="230" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#5EF0B2" letter-spacing="3">DIGITAL BADGE</text>
<text x="80" y="300" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="64" font-weight="800" fill="#FBFDFC">Reuse Starter</text>
<text x="80" y="356" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="30" font-weight="600" fill="#FBFDFC">${who}</text>
<text x="80" y="400" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="24" fill="#A7B4C2">${via} · ${esc(date)}</text>
<text x="80" y="500" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="26" font-weight="600" fill="#FBFDFC">Keep useful equipment in circulation.</text>
<text x="80" y="548" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="19" fill="#7D8C9C">Participation badge, not a verified exchange or carbon saving. No monetary value. ReLoop prototype.</text>
</svg>`;
}

function save(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** PNG through a canvas; falls back to the SVG file if the browser can't rasterise it. */
export async function downloadCard(a: Achievement, name: string): Promise<"png" | "svg"> {
  const svg = await cardSvg(a, name);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg load"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 630;
    c.getContext("2d")!.drawImage(img, 0, 0);
    const png = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    if (!png) throw new Error("toBlob");
    const url = URL.createObjectURL(png);
    save(url, "reloop-reuse-starter.png");
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "png";
  } catch {
    save(svgUrl, "reloop-reuse-starter.svg");
    return "svg";
  } finally {
    setTimeout(() => URL.revokeObjectURL(svgUrl), 4000);
  }
}
