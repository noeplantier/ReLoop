// Small inline icon set (stroke icons, 24px grid). Decorative unless a label is given.
type Name =
  | "chair" | "calendar" | "pin" | "search" | "arrow" | "leaf" | "sparkle" | "chevron"
  | "back" | "plus" | "minus" | "x" | "check" | "warn" | "info" | "light" | "table" | "stage" | "sign";

const paths: Record<Name, JSX.Element> = {
  chair: (
    <>
      <path d="M7 3h10v8H7z" />
      <path d="M5 11h14v3H5z" />
      <path d="M7 14v7M17 14v7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <path d="M5 19c3-4 6-7 10-9" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  back: <path d="M15 5l-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  warn: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5v.01" />
    </>
  ),
  light: (
    <>
      <path d="M8 4h8l-1.5 7h-5z" />
      <path d="M12 11v3M8 21h8M12 14l-3 7M12 14l3 7" />
    </>
  ),
  table: (
    <>
      <path d="M3 8h18v3H3z" />
      <path d="M6 11v9M18 11v9" />
    </>
  ),
  stage: (
    <>
      <path d="M3 14h18v6H3z" />
      <path d="M6 14V6h12v8M3 6h18" />
    </>
  ),
  sign: (
    <>
      <rect x="4" y="4" width="16" height="10" rx="1.5" />
      <path d="M12 14v7M9 21h6" />
    </>
  ),
};

export function Icon({ name, size = 20, label }: { name: Name; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {paths[name]}
    </svg>
  );
}
