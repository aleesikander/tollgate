"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { n: 1, label: "Create an agent", detail: "Register in the dashboard, copy your API key" },
  { n: 2, label: "Write a policy", detail: "Define rules in YAML — allow, deny, or require approval" },
  { n: 3, label: "Install the SDK", detail: "pip install or npm install in 30 seconds" },
  { n: 4, label: "Protect your tools", detail: "Wrap with @tg.guard() or tg.guard()" },
  { n: 5, label: "Go live", detail: "Full audit trail, human-in-the-loop on every sensitive action" },
];

const TICK_MS = 1400;
const ACCENT = "#F4533C";
const GREEN = "#22c55e";

export function QuickstartStepper() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((n) => (n + 1) % STEPS.length), TICK_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="not-prose"
      style={{
        margin: "24px 0",
        borderRadius: 14,
        border: "1px solid var(--color-fd-border)",
        background: "var(--color-fd-card)",
        padding: "20px 20px 24px",
      }}
    >
      {/* Track */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {STEPS.map((step, i) => {
          const isActive = i === active;
          const isDone = i < active;

          return (
            <div
              key={step.n}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              {/* Connector row */}
              <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background:
                      i === 0
                        ? "transparent"
                        : isDone || isActive
                        ? "rgba(244,83,60,0.45)"
                        : "var(--color-fd-border)",
                    transition: "background 0.5s ease",
                  }}
                />
                {/* Badge */}
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "monospace",
                    background: isActive
                      ? ACCENT
                      : isDone
                      ? "rgba(34,197,94,0.12)"
                      : "rgba(255,255,255,0.05)",
                    border: `1.5px solid ${
                      isActive ? ACCENT : isDone ? "rgba(34,197,94,0.45)" : "var(--color-fd-border)"
                    }`,
                    color: isActive ? "#fff" : isDone ? GREEN : "var(--color-fd-muted-foreground)",
                    boxShadow: isActive ? "0 0 14px rgba(244,83,60,0.35)" : "none",
                    transition: "all 0.45s ease",
                  }}
                >
                  {isDone ? "✓" : step.n}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background:
                      i === STEPS.length - 1
                        ? "transparent"
                        : isDone
                        ? "rgba(244,83,60,0.45)"
                        : "var(--color-fd-border)",
                    transition: "background 0.5s ease",
                  }}
                />
              </div>

              {/* Label */}
              <div style={{ marginTop: 10, padding: "0 6px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 3,
                    color:
                      isActive || isDone
                        ? "var(--color-fd-foreground)"
                        : "var(--color-fd-muted-foreground)",
                    transition: "color 0.45s ease",
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    lineHeight: 1.45,
                    color: "var(--color-fd-muted-foreground)",
                    opacity: isActive ? 1 : isDone ? 0.75 : 0.4,
                    transition: "opacity 0.45s ease",
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
