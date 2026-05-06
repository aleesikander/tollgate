"use client";

import { useEffect, useState } from "react";

const MAIN = [
  { n: 1, label: "Agent calls tool", detail: "SDK intercepts the action" },
  { n: 2, label: "Tollgate.check()", detail: "Request sent to API", mono: true },
  { n: 3, label: "Policy evaluated", detail: "Rules matched in <1ms" },
  { n: 4, label: "Decision returned", detail: "allow · deny · pending" },
];

const PENDING = [
  { n: 5, label: "Slack notification", detail: "Team gets an approval request" },
  { n: 6, label: "Human decides", detail: "Approve or reject in one click" },
  { n: 7, label: "Agent resumes", detail: "Or receives a denial reason" },
];

const TOTAL = MAIN.length + PENDING.length;
const TICK_MS = 1000;
const ACCENT = "#F4533C";

function StepBox({
  n, label, detail, mono, isActive, isDone,
}: {
  n: number; label: string; detail: string;
  mono?: boolean; isActive: boolean; isDone: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 130,
        borderRadius: 10,
        padding: "12px",
        border: `1px solid ${isActive ? "rgba(244,83,60,0.45)" : isDone ? "rgba(244,83,60,0.2)" : "var(--color-fd-border)"}`,
        background: isActive ? "rgba(244,83,60,0.07)" : isDone ? "rgba(244,83,60,0.03)" : "transparent",
        boxShadow: isActive ? "0 0 0 1px rgba(244,83,60,0.1), 0 4px 12px rgba(244,83,60,0.08)" : "none",
        transition: "all 0.4s ease",
      }}
    >
      {/* Step number badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div
          style={{
            width: 20, height: 20, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, fontFamily: "monospace",
            background: isActive ? ACCENT : isDone ? "rgba(244,83,60,0.25)" : "rgba(255,255,255,0.06)",
            color: isActive ? "#fff" : isDone ? "rgba(244,83,60,0.8)" : "rgba(255,255,255,0.25)",
            transition: "all 0.4s ease",
          }}
        >
          {n}
        </div>
        {isActive && (
          <span
            style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: ACCENT, opacity: 0.75,
              animation: "tgPing 1s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        )}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 11, fontWeight: 600, lineHeight: 1.3, marginBottom: 4,
          fontFamily: mono ? "monospace" : "inherit",
          color: isActive || isDone
            ? "var(--color-fd-foreground)"
            : "var(--color-fd-muted-foreground)",
          transition: "color 0.4s ease",
        }}
      >
        {label}
      </div>

      {/* Detail */}
      <div
        style={{
          fontSize: 10, lineHeight: 1.4,
          color: "var(--color-fd-muted-foreground)",
          opacity: isActive || isDone ? 1 : 0.6,
          transition: "opacity 0.4s ease",
        }}
      >
        {detail}
      </div>
    </div>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, paddingTop: 17, padding: "17px 4px 0" }}>
      <div
        style={{
          height: 1, width: 24,
          background: active ? "rgba(244,83,60,0.45)" : "var(--color-fd-border)",
          transition: "background 0.4s ease",
        }}
      />
      <svg width="5" height="7" viewBox="0 0 5 7" fill="none">
        <path
          d="M0 0L5 3.5L0 7V0Z"
          fill={active ? "rgba(244,83,60,0.5)" : "var(--color-fd-muted-foreground)"}
          style={{ transition: "fill 0.4s ease" }}
        />
      </svg>
    </div>
  );
}

export function HowItWorksFlow() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % TOTAL), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const inPending = tick >= MAIN.length;
  const pendingTick = tick - MAIN.length;

  return (
    <div
      className="not-prose"
      style={{
        margin: "24px 0",
        borderRadius: 14,
        border: "1px solid var(--color-fd-border)",
        background: "var(--color-fd-card)",
        padding: 20,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes tgPing {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(2); opacity: 0; }
        }
      `}</style>

      {/* Main flow */}
      <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 0 }}>
        {MAIN.map((step, i) => (
          <div key={step.n} style={{ display: "flex", alignItems: "flex-start" }}>
            <StepBox
              n={step.n}
              label={step.label}
              detail={step.detail}
              mono={step.mono}
              isActive={!inPending && i === tick}
              isDone={inPending || i < tick}
            />
            {i < MAIN.length - 1 && (
              <FlowArrow active={inPending || i < tick} />
            )}
          </div>
        ))}
      </div>

      {/* Pending divider */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          margin: "16px 0",
          opacity: tick >= MAIN.length - 1 ? 1 : 0.2,
          transition: "opacity 0.6s ease",
        }}
      >
        <div style={{ height: 1, flex: 1, background: "var(--color-fd-border)" }} />
        <span style={{ fontSize: 10, fontFamily: "monospace", color: ACCENT, letterSpacing: "0.06em", flexShrink: 0 }}>
          ↓ if pending
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--color-fd-border)" }} />
      </div>

      {/* Pending flow */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 0,
          opacity: inPending ? 1 : 0.3,
          transition: "opacity 0.6s ease",
        }}
      >
        {PENDING.map((step, i) => {
          const isActive = inPending && i === pendingTick;
          const isDone = inPending && i < pendingTick;
          return (
            <div key={step.n} style={{ display: "flex", alignItems: "flex-start" }}>
              <StepBox
                n={step.n}
                label={step.label}
                detail={step.detail}
                isActive={isActive}
                isDone={isDone}
              />
              {i < PENDING.length - 1 && (
                <FlowArrow active={isDone} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
