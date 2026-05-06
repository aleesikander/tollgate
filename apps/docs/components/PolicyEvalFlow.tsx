"use client";

import { useEffect, useState } from "react";

type RuleState = "idle" | "checking" | "matched" | "skipped";

interface Frame {
  scenario: number;
  states: RuleState[];
  decision: string | null;
}

const SCENARIOS = [
  { amount: 20, label: 'issue_refund({ amount: 20.00 })' },
  { amount: 150, label: 'issue_refund({ amount: 150.00 })' },
  { amount: 300, label: 'issue_refund({ amount: 300.00 })' },
];

const RULES = [
  { condition: "amount ≤ 25", decide: "allow", color: "#22c55e" },
  { condition: "amount ≤ 250", decide: "require_approval", color: "#F4533C" },
  { condition: "amount > 250", decide: "deny", color: "#ef4444" },
];

// Pre-computed animation timeline
const TIMELINE: Frame[] = [
  // Scenario 0: amount=20 → rule 0 matches → allow
  { scenario: 0, states: ["idle", "idle", "idle"], decision: null },
  { scenario: 0, states: ["checking", "idle", "idle"], decision: null },
  { scenario: 0, states: ["matched", "idle", "idle"], decision: "allow" },
  { scenario: 0, states: ["matched", "idle", "idle"], decision: "allow" },

  // Scenario 1: amount=150 → rule 0 no match → rule 1 matches → require_approval
  { scenario: 1, states: ["idle", "idle", "idle"], decision: null },
  { scenario: 1, states: ["checking", "idle", "idle"], decision: null },
  { scenario: 1, states: ["skipped", "idle", "idle"], decision: null },
  { scenario: 1, states: ["skipped", "checking", "idle"], decision: null },
  { scenario: 1, states: ["skipped", "matched", "idle"], decision: "require_approval" },
  { scenario: 1, states: ["skipped", "matched", "idle"], decision: "require_approval" },

  // Scenario 2: amount=300 → rules 0,1 no match → rule 2 matches → deny
  { scenario: 2, states: ["idle", "idle", "idle"], decision: null },
  { scenario: 2, states: ["checking", "idle", "idle"], decision: null },
  { scenario: 2, states: ["skipped", "idle", "idle"], decision: null },
  { scenario: 2, states: ["skipped", "checking", "idle"], decision: null },
  { scenario: 2, states: ["skipped", "skipped", "idle"], decision: null },
  { scenario: 2, states: ["skipped", "skipped", "checking"], decision: null },
  { scenario: 2, states: ["skipped", "skipped", "matched"], decision: "deny" },
  { scenario: 2, states: ["skipped", "skipped", "matched"], decision: "deny" },
];

const TICK_MS = 600;
const ACCENT = "#F4533C";

function decisionStyle(decision: string): { bg: string; border: string; color: string; label: string } {
  if (decision === "allow") return { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.35)", color: "#22c55e", label: "allow" };
  if (decision === "deny") return { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.35)", color: "#ef4444", label: "deny" };
  return { bg: "rgba(244,83,60,0.08)", border: "rgba(244,83,60,0.35)", color: ACCENT, label: "require_approval" };
}

function ruleStateStyle(state: RuleState, ruleDecide: string, ruleColor: string) {
  if (state === "matched") {
    return {
      border: `1px solid ${ruleColor}40`,
      background: `${ruleColor}08`,
      opacity: 1,
    };
  }
  if (state === "checking") {
    return {
      border: `1px solid ${ACCENT}60`,
      background: `${ACCENT}06`,
      opacity: 1,
    };
  }
  if (state === "skipped") {
    return {
      border: "1px solid var(--color-fd-border)",
      background: "transparent",
      opacity: 0.35,
    };
  }
  return {
    border: "1px solid var(--color-fd-border)",
    background: "transparent",
    opacity: 1,
  };
}

export function PolicyEvalFlow() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % TIMELINE.length), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const frame = TIMELINE[tick];
  const scenario = SCENARIOS[frame.scenario];

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
        @keyframes evalPing {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0; transform: scale(2.2); }
        }
      `}</style>

      {/* Incoming action */}
      <div
        style={{
          marginBottom: 16,
          borderRadius: 8,
          border: "1px solid var(--color-fd-border)",
          background: "rgba(255,255,255,0.02)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            color: "var(--color-fd-muted-foreground)",
            flexShrink: 0,
          }}
        >
          INCOMING
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            fontWeight: 500,
            color: "var(--color-fd-foreground)",
            flex: 1,
            transition: "color 0.3s ease",
          }}
        >
          {scenario.label}
        </div>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: ACCENT,
            animation: "evalPing 1.2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      </div>

      {/* Rules */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {RULES.map((rule, i) => {
          const state = frame.states[i];
          const s = ruleStateStyle(state, rule.decide, rule.color);

          return (
            <div
              key={i}
              style={{
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.35s ease",
                ...s,
              }}
            >
              {/* Rule number */}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  flexShrink: 0,
                  background: state === "checking" ? ACCENT : state === "matched" ? rule.color : "rgba(255,255,255,0.06)",
                  color: state === "checking" || state === "matched" ? "#fff" : "var(--color-fd-muted-foreground)",
                  transition: "all 0.35s ease",
                }}
              >
                {i + 1}
              </div>

              {/* Condition */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: state === "idle" || state === "skipped"
                      ? "var(--color-fd-muted-foreground)"
                      : "var(--color-fd-foreground)",
                    transition: "color 0.35s ease",
                  }}
                >
                  when: {rule.condition}
                </span>
                <span style={{ fontSize: 10, color: "var(--color-fd-muted-foreground)", opacity: 0.5 }}>→</span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: state === "matched" ? rule.color : "var(--color-fd-muted-foreground)",
                    transition: "color 0.35s ease",
                  }}
                >
                  {rule.decide}
                </span>
              </div>

              {/* State indicator */}
              <div style={{ flexShrink: 0, fontSize: 10, fontFamily: "monospace", minWidth: 56, textAlign: "right" }}>
                {state === "checking" && (
                  <span style={{ color: ACCENT, letterSpacing: "0.04em" }}>checking…</span>
                )}
                {state === "matched" && (
                  <span style={{ color: rule.color, letterSpacing: "0.04em" }}>matched ✓</span>
                )}
                {state === "skipped" && (
                  <span style={{ color: "var(--color-fd-muted-foreground)", opacity: 0.5 }}>skipped</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Decision output */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 36,
        }}
      >
        <div
          style={{
            height: 1,
            flex: 1,
            background: frame.decision ? "rgba(255,255,255,0.06)" : "transparent",
            transition: "background 0.4s ease",
          }}
        />
        {frame.decision && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 8,
              border: `1px solid ${decisionStyle(frame.decision).border}`,
              background: decisionStyle(frame.decision).bg,
              padding: "6px 14px",
              transition: "all 0.4s ease",
            }}
          >
            <span style={{ fontSize: 10, color: "var(--color-fd-muted-foreground)", fontFamily: "monospace" }}>
              decision:
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: 700,
                color: decisionStyle(frame.decision).color,
                letterSpacing: "0.02em",
              }}
            >
              {decisionStyle(frame.decision).label}
            </span>
          </div>
        )}
        <div
          style={{
            height: 1,
            flex: 1,
            background: frame.decision ? "rgba(255,255,255,0.06)" : "transparent",
            transition: "background 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
