const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const SearchIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);

export const UserIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  </svg>
);

export const BagIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M5 8h14l-1 12.5H6L5 8z" />
    <path d="M9 8V6.5a3 3 0 016 0V8" />
  </svg>
);

export const ChevronIcon = ({ dir = "down" }: { dir?: "down" | "left" | "right" }) => (
  <svg
    {...base}
    width={12}
    height={12}
    style={{ transform: dir === "left" ? "rotate(90deg)" : dir === "right" ? "rotate(-90deg)" : undefined }}
    aria-hidden
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base} width={12} height={12} aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
