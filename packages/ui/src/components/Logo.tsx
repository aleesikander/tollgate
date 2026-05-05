import type { FC, CSSProperties } from "react";

const markSizes = { sm: 16, md: 20, lg: 32 } as const;
const textSizes = { sm: 12, md: 14, lg: 24 } as const;

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

  const mark = (
    <svg
      width={markPx}
      height={markPx}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <line
        x1="5" y1="6" x2="5" y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="19" y1="6" x2="19" y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="5" y1="12" x2="19" y2="12"
        stroke="#F4533C"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );

  const wordmark = (
    <span
      style={{
        fontSize: textPx,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        lineHeight: 1,
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
      style={{ display: "inline-flex", alignItems: "center", gap: 9, ...style }}
      className={className}
    >
      {mark}
      {wordmark}
    </span>
  );
};
