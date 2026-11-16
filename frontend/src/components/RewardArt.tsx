import { logoUrl } from "./Brand";

/** The earned digital badge (or its locked outline). */
export function BadgeArt({ unlocked, size = 120 }: { unlocked: boolean; size?: number }) {
  return (
    <svg className={`badge-art ${unlocked ? "is-unlocked" : "is-locked"}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="badge-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--mint)" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
      {unlocked && <circle className="badge-art__ring" cx="60" cy="60" r="54" fill="none" stroke="url(#badge-ring)" strokeWidth="4"
        strokeDasharray="250 90" strokeLinecap="round" transform="rotate(-90 60 60)" />}
      <circle cx="60" cy="60" r="40" fill="var(--surface)" stroke={unlocked ? "var(--brand)" : "var(--line-strong)"} strokeWidth="1.5"
        strokeDasharray={unlocked ? undefined : "4 5"} />
      <image href={logoUrl} x="38" y="37" width="44" height="46" opacity={unlocked ? 1 : 0.35} />
    </svg>
  );
}

type Concept = "tshirt" | "shoes" | "travel";

/** Product-style concept renders. Concepts only: nothing here exists, is stocked or can be claimed. */
export function ConceptArt({ kind }: { kind: Concept }) {
  return (
    <svg className="concept-art" viewBox="0 0 240 150" role="img" aria-label={`Concept illustration: ReLoop ${kind === "travel" ? "travel experience" : kind}`}>
      <defs>
        <radialGradient id={`c-glow-${kind}`} cx="0.5" cy="0.55" r="0.6">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="150" fill={`url(#c-glow-${kind})`} />
      {kind === "tshirt" && (
        <g>
          <path d="M84 30l-30 16 12 26 14-6v60h80V66l14 6 12-26-30-16c-4 10-14 16-36 16s-32-6-36-16z"
            fill="#0e1f33" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M102 30c3 8 9 12 18 12s15-4 18-12" fill="none" stroke="var(--mint)" strokeOpacity="0.6" strokeWidth="1.4" />
          <image href={logoUrl} x="106" y="62" width="28" height="29" />
        </g>
      )}
      {kind === "shoes" && (
        <g>
          <path d="M40 104c0-14 6-30 18-36 10 6 26 10 40 8 12 10 36 16 64 18 14 2 22 8 22 14v6H40z"
            fill="#0e1f33" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M40 112h144v8a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6z" fill="var(--surface-2)" stroke="var(--mint)" strokeOpacity="0.55" strokeWidth="1.4" />
          <path d="M70 74l8 10M82 72l8 10M94 74l8 10" stroke="var(--mint)" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
          <image href={logoUrl} x="128" y="92" width="18" height="19" />
        </g>
      )}
      {kind === "travel" && (
        <g>
          <path d="M28 118c40-8 70-30 92-62" fill="none" stroke="var(--mint)" strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="3 6" />
          <g transform="translate(150 46) rotate(-28)">
            <path d="M-40 0c0-4 4-7 10-7h52l16-18h8l-8 18h14l6-7h5l-3 14 3 14h-5l-6-7H34l8 18h-8L18 7h-48c-6 0-10-3-10-7z"
              fill="#0e1f33" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" />
            <image href={logoUrl} x="-26" y="-6" width="11" height="12" />
          </g>
          <path d="M150 120c8-14 30-14 40 0z" fill="#0e1f33" stroke="var(--brand)" strokeWidth="1.4" />
          <path d="M178 120c-2-12 2-24 10-32M188 88c-8-2-16 2-18 6M188 88c6-6 14-6 18-2M188 88c2-6 0-12-6-14" fill="none"
            stroke="var(--mint)" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
