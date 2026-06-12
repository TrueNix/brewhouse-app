// Hand-built icon set (Lucide-style, 24px grid). No icon dependency.

import type { CSSProperties } from "react";

const PATHS: Record<string, JSX.Element> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </>
  ),
  arrowRight: <path d="M5 12h14m-6-7 7 7-7 7" />,
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <path d="M6 8.4v7.2" />
      <path d="M18 9.4c0 4-4 4.6-7.5 5.6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 13h10l1-13" />
    </>
  ),
  pin: (
    <>
      <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5z" />
      <path d="M12 14v6" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 4v4h-4" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 20v-4h4" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevronUp: <path d="m6 14 6-6 6 6" />,
  chevronDown: <path d="m6 10 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4 6.2 6.2 0 0 0 20 13.5z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m7 9 3 3-3 3" />
      <path d="M13 15h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  beer: (
    <>
      <path d="M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z" />
      <path d="M15 10h2.5A2.5 2.5 0 0 1 20 12.5v2A2.5 2.5 0 0 1 17.5 17H15" />
      <path d="M6 8a3 3 0 1 1 1.5-5.6A3 3 0 0 1 13 3a2.5 2.5 0 0 1 2 5" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />,
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 18, strokeWidth = 1.7, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
