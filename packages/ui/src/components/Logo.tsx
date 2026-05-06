import type { FC, CSSProperties } from "react";

const markSizes = { sm: 18, md: 26, lg: 38 } as const;
const textSizes = { sm: 14, md: 19, lg: 30 } as const;
const gaps      = { sm: 8,  md: 11, lg: 14 } as const;

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "mark-only" | "wordmark-only";
  style?: CSSProperties;
  className?: string;
}

export const Logo: FC<LogoProps> = ({
  size = "md",
  variant = "full",
  style,
  className,
}) => {
  const markPx = markSizes[size];
  const textPx = textSizes[size];
  const gapPx  = gaps[size];

  // Unique IDs per size — avoids SVG defs collisions when nav + footer both mount
  const clipId = `tg-clip-${size}`;
  const patId  = `tg-stripe-${size}`;

  /*
    Mark: two angular gate pillars (wider at top, angled inner edge) + striped barrier bar.
    viewBox 0 0 100 100. All shapes in accent orange; barrier gets diagonal dark stripes.

    Left pillar path (clockwise):
      outer-top-left → inner-top-right → chamfer-corner (3D face) →
      inner-edge tapers to barrier → notch for barrier →
      [barrier gap] → notch out → inner-edge to bottom → bottom-left

    Right pillar is the horizontal mirror.
  */
  const mark = (
    <svg
      width={markPx}
      height={markPx}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        {/* Clip the stripe pattern to the barrier rect */}
        <clipPath id={clipId}>
          <rect x="28" y="43" width="44" height="15" rx="2" />
        </clipPath>

        {/* Diagonal stripe tile — vertical lines rotated to / direction */}
        <pattern
          id={patId}
          patternUnits="userSpaceOnUse"
          width="7"
          height="7"
          patternTransform="rotate(-45)"
        >
          <rect width="7" height="7" fill="#F4533C" />
          <rect width="3" height="7" fill="#0a0a0a" />
        </pattern>
      </defs>

      {/* Left pillar */}
      <path
        d="M 13,12 L 41,12 L 36,20 L 31,43 L 28,43 L 28,58 L 31,58 L 35,88 L 13,88 Z"
        fill="#F4533C"
      />

      {/* Right pillar (mirror) */}
      <path
        d="M 87,12 L 59,12 L 64,20 L 69,43 L 72,43 L 72,58 L 69,58 L 65,88 L 87,88 Z"
        fill="#F4533C"
      />

      {/* Barrier — orange base */}
      <rect x="28" y="43" width="44" height="15" rx="2" fill="#F4533C" />

      {/* Barrier — diagonal stripe overlay */}
      <rect
        x="28" y="43" width="44" height="15"
        clipPath={`url(#${clipId})`}
        fill={`url(#${patId})`}
      />

      {/* Barrier — dark border to separate from pillars */}
      <rect
        x="28" y="43" width="44" height="15"
        rx="2"
        fill="none"
        stroke="#0a0a0a"
        strokeWidth="2.5"
      />
    </svg>
  );

  const wordmark = (
    <span
      style={{
        fontSize: textPx,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        background: "linear-gradient(95deg, #ffffff 20%, #F4533C 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      tollgate
    </span>
  );

  if (variant === "mark-only") {
    return (
      <span style={style} className={className}>
        {mark}
      </span>
    );
  }

  if (variant === "wordmark-only") {
    return (
      <span style={style} className={className}>
        {wordmark}
      </span>
    );
  }

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: gapPx, ...style }}
      className={className}
    >
      {mark}
      {wordmark}
    </span>
  );
};
