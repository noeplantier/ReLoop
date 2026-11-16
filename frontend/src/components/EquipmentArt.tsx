import type { Category } from "../lib/types";

// Representative illustrations, drawn locally per CATEGORY. They are not photos of the listed item and show no
// brand, size or accessory. Every use is labelled "Illustration".
const S = { stroke: "var(--art-line)", strokeWidth: 2.2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const F = { fill: "var(--art-fill)", stroke: "var(--art-line)", strokeWidth: 2.2, strokeLinejoin: "round" } as const;

const art: Record<Category, JSX.Element> = {
  chairs: (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${38 + i * 44} ${i % 2 ? 6 : 0})`} opacity={i === 1 ? 1 : 0.75}>
          <rect x="4" y="10" width="30" height="30" rx="5" {...F} />
          <rect x="0" y="40" width="38" height="8" rx="3" {...F} />
          <path d="M4 48l-2 30M34 48l2 30M10 48l1 20M28 48l-1 20" {...S} />
        </g>
      ))}
    </g>
  ),
  tables: (
    <g>
      <ellipse cx="100" cy="44" rx="62" ry="15" {...F} />
      <path d="M38 44v6c0 8 28 15 62 15s62-7 62-15v-6" {...S} />
      <path d="M100 65v22M80 92h40" {...S} />
      <path d="M58 58l-12 30M142 58l12 30" {...S} opacity="0.5" />
    </g>
  ),
  lighting: (
    <g>
      <path d="M40 20h120" {...S} />
      {[70, 130].map((x) => (
        <g key={x}>
          <path d={`M${x} 20v10`} {...S} />
          <rect x={x - 12} y="30" width="24" height="26" rx="6" {...F} />
          <path d={`M${x - 10} 56L${x - 34} 96h${68}L${x + 10} 56z`} fill="var(--art-beam)" stroke="none" />
          <circle cx={x} cy="56" r="5" fill="var(--mint)" />
        </g>
      ))}
    </g>
  ),
  staging: (
    <g>
      <path d="M30 50h140l-14 14H44z" {...F} />
      <rect x="44" y="64" width="112" height="22" rx="2" {...F} />
      <path d="M66 64v22M100 64v22M134 64v22" {...S} opacity="0.55" />
      <path d="M40 20v30M160 20v30M40 20h120" {...S} />
      <path d="M40 20l20 30M160 20l-20 30" {...S} opacity="0.4" />
    </g>
  ),
  signage: (
    <g>
      <rect x="56" y="14" width="88" height="54" rx="6" {...F} />
      <path d="M72 34h56M72 46h36" {...S} />
      <path d="M78 68l-14 26M122 68l14 26M100 68v26" {...S} />
    </g>
  ),
};

export function EquipmentArt({ category, label = true }: { category: Category; label?: boolean }) {
  return (
    <figure className="eq-art">
      <svg viewBox="0 0 200 100" role="img" aria-label={`Illustration of ${category}`}>
        <defs>
          <radialGradient id={`eq-glow-${category}`} cx="0.5" cy="0.9" r="0.7">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="100" fill={`url(#eq-glow-${category})`} />
        <path d="M14 96h172" stroke="var(--line-strong)" strokeWidth="1" />
        {art[category]}
      </svg>
      {label && <figcaption className="eq-art__cap">Illustration</figcaption>}
    </figure>
  );
}
