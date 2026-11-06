// Line icons drawn on a 24px grid with one stroke style, so they all match.
type IconProps = { size?: number; className?: string };

function Svg({ size = 16, className, style, children }: IconProps & { style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  </Svg>
);

export const BagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 8h14l-1 12.5H6L5 8z" />
    <path d="M9 8V6.5a3 3 0 016 0V8" />
  </Svg>
);

export const ChevronIcon = ({ dir = "down", size = 12, className }: IconProps & { dir?: "down" | "left" | "right" }) => (
  <Svg
    size={size}
    className={className}
    style={{ transform: dir === "left" ? "rotate(90deg)" : dir === "right" ? "rotate(-90deg)" : undefined }}
  >
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const CloseIcon = ({ size = 12, className }: IconProps) => (
  <Svg size={size} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ArrowLeftIcon = ({ size = 14, className }: IconProps) => (
  <Svg size={size} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const PlusIcon = ({ size = 14, className }: IconProps) => (
  <Svg size={size} className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CheckIcon = ({ size = 14, className }: IconProps) => (
  <Svg size={size} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const CopyIcon = ({ size = 14, className }: IconProps) => (
  <Svg size={size} className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3" />
  </Svg>
);

export const TrashIcon = ({ size = 14, className }: IconProps) => (
  <Svg size={size} className={className}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </Svg>
);

export const ImageIcon = ({ size = 20, className }: IconProps) => (
  <Svg size={size} className={className}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 15.5l-5-5-9 9" />
  </Svg>
);

export const MirrorIcon = ({ size = 14, className }: IconProps) => (
  <Svg size={size} className={className}>
    <path d="M12 3v18M8.5 7.5L3.5 12l5 4.5v-9zM15.5 7.5l5 4.5-5 4.5v-9z" />
  </Svg>
);

export const SpinnerIcon = ({ size = 14, className = "" }: IconProps) => (
  <Svg size={size} className={`animate-spin ${className}`}>
    <path d="M12 3a9 9 0 109 9" />
  </Svg>
);
