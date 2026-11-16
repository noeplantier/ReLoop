import { useMemo } from "react";

// Lightweight CSS confetti in the brand greens. Decorative only; hidden with reduced motion.
const COLORS = ["var(--brand)", "var(--mint)", "#0cc472", "#b8f7dc"];

export function Confetti({ count = 44 }: { count?: number }) {
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 1.6 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 160,
    rot: Math.random() * 720 - 360,
    w: 5 + Math.random() * 5,
    round: i % 3 === 0,
    color: COLORS[i % COLORS.length],
  })), [count]);
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span key={i} style={{
          left: `${b.left}%`, width: b.w, height: b.round ? b.w : b.w * 1.8, background: b.color,
          borderRadius: b.round ? "50%" : 2, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`,
          ["--drift" as string]: `${b.drift}px`, ["--rot" as string]: `${b.rot}deg`,
        }} />
      ))}
    </div>
  );
}
