// Decorative illustration for the landing hero (drawn, not a photo): an evening event set-up with a stage
// truss, two lights and rows of white chairs, in the ReLoop palette. Hidden from screen readers.
const rows = [
  { y: 232, s: 1.0, n: 9, x0: 18, dx: 44 },
  { y: 206, s: 0.82, n: 10, x0: 30, dx: 37 },
  { y: 186, s: 0.68, n: 11, x0: 44, dx: 31 },
  { y: 170, s: 0.56, n: 12, x0: 58, dx: 26 },
];

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1828" />
          <stop offset="0.55" stopColor="#123a4a" />
          <stop offset="1" stopColor="#1c5a52" />
        </linearGradient>
        <radialGradient id="glow" cx="0.78" cy="0.42" r="0.5">
          <stop offset="0" stopColor="#5ef0b2" stopOpacity="0.35" />
          <stop offset="1" stopColor="#5ef0b2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9fff6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e9fff6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f2b2f" />
          <stop offset="1" stopColor="#0b1828" />
        </linearGradient>
        <g id="chair">
          <rect x="-7" y="-20" width="14" height="11" rx="2" fill="#eef4f2" />
          <rect x="-8" y="-9" width="16" height="3.5" rx="1.5" fill="#dfe8e6" />
          <rect x="-7" y="-6" width="2" height="12" fill="#cfdad8" />
          <rect x="5" y="-6" width="2" height="12" fill="#cfdad8" />
        </g>
        <g id="palm">
          <path d="M0 0 C 2 -30, 4 -60, 2 -92" stroke="#08202a" strokeWidth="5" fill="none" />
          <path d="M2 -92 C -20 -96, -36 -88, -46 -76 M2 -92 C 22 -98, 38 -90, 46 -78 M2 -92 C -8 -110, -26 -114, -38 -110 M2 -92 C 12 -112, 30 -116, 42 -110 M2 -92 C 0 -112, 4 -124, 10 -128"
            stroke="#08202a" strokeWidth="6" strokeLinecap="round" fill="none" />
        </g>
      </defs>

      <rect width="400" height="260" fill="url(#sky)" />
      <rect width="400" height="260" fill="url(#glow)" />
      <circle cx="58" cy="40" r="1.2" fill="#cfe" opacity="0.7" />
      <circle cx="120" cy="22" r="1" fill="#cfe" opacity="0.5" />
      <circle cx="180" cy="48" r="1.1" fill="#cfe" opacity="0.6" />

      <use href="#palm" transform="translate(40 168)" />
      <use href="#palm" transform="translate(96 160) scale(0.8)" />
      <use href="#palm" transform="translate(362 166) scale(0.9)" />

      {/* stage truss with two lights */}
      <g stroke="#2a4f5e" strokeWidth="3" fill="none">
        <path d="M250 60 V160 M350 60 V160 M246 60 H354" />
        <path d="M250 70 L262 60 M262 60 L274 70 M274 70 L286 60 M286 60 L298 70 M298 70 L310 60 M310 60 L322 70 M322 70 L334 60 M334 60 L346 70" strokeWidth="1.5" />
      </g>
      <path d="M275 64 L238 160 L300 160 Z" fill="url(#beam)" />
      <path d="M325 64 L306 160 L368 160 Z" fill="url(#beam)" />
      <rect x="269" y="60" width="12" height="9" rx="2" fill="#0ab567" />
      <rect x="319" y="60" width="12" height="9" rx="2" fill="#0ab567" />

      <rect y="158" width="400" height="102" fill="url(#ground)" />

      {[...rows].reverse().map((r) =>
        Array.from({ length: r.n }, (_, i) => (
          <use key={`${r.y}-${i}`} href="#chair" transform={`translate(${r.x0 + i * r.dx} ${r.y}) scale(${r.s})`} />
        )),
      )}
      <rect width="400" height="260" fill="url(#sky)" opacity="0.12" />
    </svg>
  );
}
