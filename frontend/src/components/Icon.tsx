// Small inline icon set (stroke icons, 24px grid). Decorative unless a label is given.
type Name =
  | "chair" | "calendar" | "pin" | "search" | "arrow" | "leaf" | "sparkle" | "chevron"
  | "back" | "plus" | "minus" | "x" | "check" | "warn" | "info" | "light" | "table" | "stage" | "sign"
  | "globe" | "loop" | "user" | "gift" | "download" | "copy" | "edit" | "trash" | "home" | "locate" | "box"
  | "prev" | "next";

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
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" />
    </>
  ),
  loop: (
    <>
      <path d="M19 12a7 7 0 0 1-12 4.9" />
      <path d="M5 12a7 7 0 0 1 12-4.9" />
      <path d="M17 3.5v3.6h-3.6M7 20.5v-3.6h3.6" />
    </>
  ),
  sign: (
    <>
      <rect x="4" y="4" width="16" height="10" rx="1.5" />
      <path d="M12 14v7M9 21h6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c1.2-3.8 4.2-5.6 7.5-5.6s6.3 1.8 7.5 5.6" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="9" width="17" height="11.5" rx="2" />
      <path d="M2.8 9h18.4M12 9v11.5M12 9c-1.6-3.9-6.4-4.4-6.4-1.6C5.6 9 12 9 12 9zM12 9c1.6-3.9 6.4-4.4 6.4-1.6C18.4 9 12 9 12 9z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11.5M7 10.5l5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.2" />
      <path d="M15.5 8.5V5.7a2.2 2.2 0 0 0-2.2-2.2H5.7a2.2 2.2 0 0 0-2.2 2.2v7.6a2.2 2.2 0 0 0 2.2 2.2h2.8" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19.3 8.7a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M6 9.5V20h12V9.5" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </>
  ),
  prev: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
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
