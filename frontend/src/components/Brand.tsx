import logoUrl from "../assets/logo-mark.png";

export { logoUrl };

export function Logo({ size = 32 }: { size?: number }) {
  return <img className="logo" src={logoUrl} alt="" width={size} height={Math.round(size * 201 / 192)} />;
}

/** Landing visual: the real logo inside slowly turning loop rings (static with reduced motion). */
export function LoopOrbit() {
  return (
    <div className="orbit" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="orbit__rings">
        <defs>
          <linearGradient id="orbit-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--mint)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
        <g className="orbit__spin">
          <circle cx="100" cy="100" r="92" fill="none" stroke="url(#orbit-g)" strokeWidth="2" strokeDasharray="210 370" strokeLinecap="round" />
          <circle cx="100" cy="8" r="3.2" fill="var(--mint)" />
        </g>
        <circle cx="100" cy="100" r="70" fill="none" stroke="var(--line)" strokeWidth="1" />
        <g className="orbit__spin orbit__spin--rev">
          <circle cx="100" cy="100" r="70" fill="none" stroke="url(#orbit-g)" strokeWidth="1.5" strokeDasharray="120 320" strokeLinecap="round" />
        </g>
      </svg>
      <div className="orbit__core">
        <img src={logoUrl} alt="" width={64} height={67} />
      </div>
    </div>
  );
}
