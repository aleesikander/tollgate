"use client";

import { useEffect, useState } from "react";

// Two scenarios: allow path and require_approval path
const SCENARIOS = [
  {
    label: "amount = $30",
    path: "allow",
    steps: [
      { id: "msg",     text: "customer message",              sub: "\"My order arrived broken\"" },
      { id: "agent",   text: "agent",                         sub: "processes request" },
      { id: "check",   text: "tg.check(\"issue_refund\", …)", sub: "amount: 30.00" },
      { id: "policy",  text: "policy: amount ≤ $50",          sub: "rule matched" },
      { id: "allow",   text: "allow instantly",               sub: "no human needed" },
      { id: "stripe",  text: "Stripe refund executes",        sub: "$30 returned" },
    ],
    connection: null,
  },
  {
    label: "amount = $75",
    path: "approval",
    steps: [
      { id: "msg",     text: "customer message",              sub: "\"My order arrived broken\"" },
      { id: "agent",   text: "agent",                         sub: "processes request" },
      { id: "check",   text: "tg.check(\"issue_refund\", …)", sub: "amount: 75.00" },
      { id: "policy",  text: "policy: amount > $50",          sub: "require_approval" },
      { id: "slack",   text: "Slack → #approvals",            sub: "Approve / Reject buttons" },
      { id: "human",   text: "human clicks Approve",          sub: "ali@company.com" },
      { id: "stripe",  text: "Stripe refund executes",        sub: "$75 returned" },
    ],
    connection: null,
  },
];

const STEP_MS    = 900;
const HOLD_MS    = 1800;
const FADE_MS    = 500;
const BETWEEN_MS = 600;

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  allow:   { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.3)",   text: "#22c55e",  dot: "#22c55e" },
  stripe:  { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.3)",   text: "#22c55e",  dot: "#22c55e" },
  policy:  { bg: "rgba(244,83,60,0.08)",   border: "rgba(244,83,60,0.3)",   text: "#F4533C",  dot: "#F4533C" },
  slack:   { bg: "rgba(69,170,242,0.08)",  border: "rgba(69,170,242,0.3)",  text: "#45AAF2",  dot: "#45AAF2" },
  human:   { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)",  text: "#F59E0B",  dot: "#F59E0B" },
  default: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", text: "var(--color-fd-foreground)", dot: "rgba(255,255,255,0.4)" },
};

function getColor(id: string) {
  return NODE_COLORS[id] ?? NODE_COLORS.default;
}

export function WhatYoullBuildFlow() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [shownCount, setShownCount]   = useState(0);
  const [fading, setFading]           = useState(false);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];

    function runScenario(idx: number) {
      const scenario = SCENARIOS[idx];
      setScenarioIdx(idx);
      setShownCount(0);
      setFading(false);

      scenario.steps.forEach((_, i) => {
        ts.push(setTimeout(() => setShownCount(i + 1), (i + 1) * STEP_MS));
      });

      const doneAt = scenario.steps.length * STEP_MS + HOLD_MS;
      ts.push(setTimeout(() => setFading(true), doneAt));
      ts.push(setTimeout(() => {
        const next = (idx + 1) % SCENARIOS.length;
        runScenario(next);
      }, doneAt + FADE_MS + BETWEEN_MS));
    }

    runScenario(0);
    return () => ts.forEach(clearTimeout);
  }, []);

  const scenario = SCENARIOS[scenarioIdx];

  return (
    <div
      className="not-prose"
      style={{ margin: "24px 0" }}
    >
      <style>{`
        @keyframes flowPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.6); }
        }
        @keyframes connectorGrow {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      <div
        style={{
          borderRadius: 14,
          border: "1px solid var(--color-fd-border)",
          background: "var(--color-fd-card)",
          padding: "20px 20px 16px",
          opacity: fading ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        {/* Scenario label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <span style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 700,
            letterSpacing: "0.08em", color: "var(--color-fd-muted-foreground)",
            textTransform: "uppercase",
          }}>
            Scenario
          </span>
          <span style={{
            fontSize: 11, fontFamily: "monospace", fontWeight: 600,
            padding: "2px 10px", borderRadius: 20,
            background: scenario.path === "allow" ? "rgba(34,197,94,0.1)" : "rgba(244,83,60,0.1)",
            color: scenario.path === "allow" ? "#22c55e" : "#F4533C",
            border: `1px solid ${scenario.path === "allow" ? "rgba(34,197,94,0.25)" : "rgba(244,83,60,0.25)"}`,
            transition: "all 0.3s ease",
          }}>
            {scenario.label} → {scenario.path === "allow" ? "auto-allow" : "require_approval"}
          </span>
        </div>

        {/* Flow nodes */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {scenario.steps.map((step, i) => {
            const visible = shownCount > i;
            const isActive = shownCount === i + 1;
            const c = getColor(step.id);

            return (
              <div
                key={`${scenarioIdx}-${step.id}-${i}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}
              >
                {/* Connector line above (not for first node) */}
                {i > 0 && (
                  <div style={{
                    width: 1,
                    height: 20,
                    background: visible ? "rgba(255,255,255,0.1)" : "transparent",
                    transformOrigin: "top",
                    transition: "background 0.3s ease",
                  }} />
                )}

                {/* Node */}
                <div
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 9,
                    border: `1px solid ${visible ? c.border : "transparent"}`,
                    background: visible ? c.bg : "transparent",
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(6px)",
                    transition: "all 0.35s ease",
                    boxShadow: isActive ? `0 0 16px ${c.dot}20` : "none",
                  }}
                >
                  {/* Dot */}
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: c.dot,
                    flexShrink: 0,
                    animation: isActive ? "flowPulse 1.2s ease-in-out infinite" : "none",
                  }} />

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 12, fontFamily: "monospace", fontWeight: 600,
                      color: c.text,
                    }}>
                      {step.text}
                    </span>
                    {step.sub && (
                      <span style={{
                        fontSize: 11, fontFamily: "monospace",
                        color: "var(--color-fd-muted-foreground)",
                        marginLeft: 10, opacity: 0.7,
                      }}>
                        — {step.sub}
                      </span>
                    )}
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <span style={{
                      fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                      letterSpacing: "0.08em", color: c.dot,
                      opacity: 0.8, textTransform: "uppercase",
                    }}>
                      now
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress */}
        <div style={{ marginTop: 18, height: 1.5, borderRadius: 2, background: "var(--color-fd-border)" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: scenario.path === "allow"
              ? "linear-gradient(90deg, #22c55e, rgba(34,197,94,0.4))"
              : "linear-gradient(90deg, #F4533C, rgba(244,83,60,0.4))",
            width: `${(shownCount / scenario.steps.length) * 100}%`,
            transition: `width ${STEP_MS * 0.8}ms ease`,
          }} />
        </div>
        <div style={{
          marginTop: 6, display: "flex", justifyContent: "space-between",
          fontSize: 10, fontFamily: "monospace", color: "var(--color-fd-muted-foreground)", opacity: 0.5,
        }}>
          <span>step {shownCount} / {scenario.steps.length}</span>
          <span>{scenario.path === "allow" ? "fast path" : "approval path"}</span>
        </div>
      </div>
    </div>
  );
}
