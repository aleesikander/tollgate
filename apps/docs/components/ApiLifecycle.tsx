"use client";

import { useEffect, useState } from "react";

// Scenarios: what decision comes back and what the follow-up is
type Scenario = { decision: "allowed" | "denied" | "pending"; label: string };

const SCENARIOS: Scenario[] = [
  { decision: "allowed", label: "amount=20 → matches allow rule" },
  { decision: "denied", label: "action=delete_account → matches deny rule" },
  { decision: "pending", label: "amount=150 → require_approval rule" },
];

// Timeline frames for each scenario
// Each frame is: which step is active (0=client, 1=api, 2=decision, 3=poll, 4=resolved)
type Frame = { active: number; showBranch: boolean; scenarioIdx: number };

const TIMELINE: Frame[] = [
  // Scenario 0: allowed (no poll needed)
  { scenarioIdx: 0, active: 0, showBranch: false },
  { scenarioIdx: 0, active: 1, showBranch: false },
  { scenarioIdx: 0, active: 2, showBranch: false },
  { scenarioIdx: 0, active: -1, showBranch: false }, // pause

  // Scenario 1: denied (no poll needed)
  { scenarioIdx: 1, active: 0, showBranch: false },
  { scenarioIdx: 1, active: 1, showBranch: false },
  { scenarioIdx: 1, active: 2, showBranch: false },
  { scenarioIdx: 1, active: -1, showBranch: false }, // pause

  // Scenario 2: pending → poll → resolved
  { scenarioIdx: 2, active: 0, showBranch: false },
  { scenarioIdx: 2, active: 1, showBranch: false },
  { scenarioIdx: 2, active: 2, showBranch: false },
  { scenarioIdx: 2, active: 3, showBranch: true },
  { scenarioIdx: 2, active: 3, showBranch: true },
  { scenarioIdx: 2, active: 4, showBranch: true },
  { scenarioIdx: 2, active: -1, showBranch: true }, // pause
];

const TICK_MS = 700;
const ACCENT = "#F4533C";

const MAIN_STEPS = [
  { label: "POST /v1/check", detail: "action + payload" },
  { label: "Policy evaluated", detail: "rules matched in <1ms" },
  { label: "Decision returned", detail: "allowed · denied · pending" },
];

function decisionColor(d: Scenario["decision"]) {
  if (d === "allowed") return { color: "#22c55e", border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.07)" };
  if (d === "denied") return { color: "#ef4444", border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.07)" };
  return { color: ACCENT, border: "rgba(244,83,60,0.35)", bg: "rgba(244,83,60,0.07)" };
}

function StepPill({ label, detail, isActive, isDone }: { label: string; detail: string; isActive: boolean; isDone: boolean }) {
  return (
    <div
      style={{
        borderRadius: 9,
        padding: "9px 12px",
        border: `1px solid ${isActive ? "rgba(244,83,60,0.45)" : isDone ? "rgba(244,83,60,0.18)" : "var(--color-fd-border)"}`,
        background: isActive ? "rgba(244,83,60,0.07)" : isDone ? "rgba(244,83,60,0.03)" : "transparent",
        boxShadow: isActive ? "0 0 12px rgba(244,83,60,0.1)" : "none",
        transition: "all 0.35s ease",
        minWidth: 110,
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 600, marginBottom: 2, fontFamily: "monospace",
        color: isActive || isDone ? "var(--color-fd-foreground)" : "var(--color-fd-muted-foreground)",
        transition: "color 0.35s ease",
      }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: "var(--color-fd-muted-foreground)", opacity: isActive || isDone ? 0.9 : 0.5 }}>
        {detail}
      </div>
    </div>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 4px", paddingTop: 2 }}>
      <div style={{ width: 20, height: 1, background: active ? "rgba(244,83,60,0.45)" : "var(--color-fd-border)", transition: "background 0.4s ease" }} />
      <svg width="5" height="7" viewBox="0 0 5 7" fill="none">
        <path d="M0 0L5 3.5L0 7V0Z" fill={active ? "rgba(244,83,60,0.5)" : "var(--color-fd-muted-foreground)"} style={{ transition: "fill 0.4s ease" }} />
      </svg>
    </div>
  );
}

export function ApiLifecycle() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % TIMELINE.length), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const frame = TIMELINE[tick];
  const scenario = SCENARIOS[frame.scenarioIdx];
  const dc = decisionColor(scenario.decision);

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
      {/* Scenario label */}
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em", color: "var(--color-fd-muted-foreground)" }}>
          EXAMPLE
        </div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-fd-muted-foreground)", opacity: 0.7 }}>
          {scenario.label}
        </div>
      </div>

      {/* Main 3-step flow */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>
        {MAIN_STEPS.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <StepPill
              label={step.label}
              detail={step.detail}
              isActive={frame.active === i}
              isDone={frame.active > i || frame.active === -1}
            />
            {i < MAIN_STEPS.length - 1 && (
              <Arrow active={frame.active > i || frame.active === -1} />
            )}
          </div>
        ))}

        {/* Decision badge at end of main flow */}
        {(frame.active >= 2 || frame.active === -1) && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <Arrow active />
            <div
              style={{
                borderRadius: 8,
                padding: "9px 12px",
                border: `1px solid ${dc.border}`,
                background: dc.bg,
                transition: "all 0.4s ease",
              }}
            >
              <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: dc.color }}>
                {scenario.decision}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending branch */}
      {frame.showBranch && (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, margin: "14px 0",
            opacity: frame.active >= 3 || frame.active === -1 ? 1 : 0.3,
            transition: "opacity 0.4s ease",
          }}>
            <div style={{ height: 1, flex: 1, background: "var(--color-fd-border)" }} />
            <span style={{ fontSize: 10, fontFamily: "monospace", color: ACCENT, letterSpacing: "0.06em", flexShrink: 0 }}>
              ↓ decision was pending — SDK polls
            </span>
            <div style={{ height: 1, flex: 1, background: "var(--color-fd-border)" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>
            <StepPill
              label="GET /v1/check/{id}"
              detail="every 2–3 seconds"
              isActive={frame.active === 3}
              isDone={frame.active === 4 || frame.active === -1}
            />
            <Arrow active={frame.active === 4 || frame.active === -1} />
            <StepPill
              label="Human decides"
              detail="approve or reject in Slack"
              isActive={frame.active === 3}
              isDone={frame.active === 4 || frame.active === -1}
            />
            <Arrow active={frame.active === 4 || frame.active === -1} />
            <StepPill
              label="Decision resolved"
              detail="SDK returns → agent continues"
              isActive={frame.active === 4}
              isDone={frame.active === -1}
            />
          </div>
        </>
      )}
    </div>
  );
}
