"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { n: 1, label: "Agent calls a guarded tool", detail: "tg.guard() sends request to Tollgate API" },
  { n: 2, label: "Policy: require_approval matched", detail: "Rule fires — action is held, not executed" },
  { n: 3, label: "Slack message posted", detail: "Action details + Approve/Reject buttons sent to #channel" },
  { n: 4, label: "SDK polls for decision", detail: "GET /v1/check/{id} every 2–3 seconds" },
  { n: 5, label: "Team member clicks Approve", detail: "One click in Slack — no dashboard needed" },
  { n: 6, label: "Slack sends webhook to Tollgate", detail: "POST /slack/interactive → decision recorded" },
  { n: 7, label: "Action status updated", detail: "approved → allowed, rejected → denied" },
  { n: 8, label: "SDK poll returns", detail: "Agent proceeds with the action — or stops cleanly" },
];

const TICK_MS = 950;
const ACCENT = "#F4533C";

// Icons as simple SVG paths
const ICONS = [
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z", // play
  "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", // check circle
  "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", // message
  "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", // refresh
  "M5 13l4 4L19 7", // check
  "M13 10V3L4 14h7v7l9-11h-7z", // lightning
  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", // clipboard
  "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z", // resume
];

export function SlackApprovalFlow() {
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
        padding: 20,
      }}
    >
      <style>{`
        @keyframes slackPing {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
        {STEPS.map((step, i) => {
          const isActive = i === active;
          const isDone = i < active;

          return (
            <div
              key={step.n}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 9,
                border: `1px solid ${
                  isActive ? "rgba(244,83,60,0.45)" : isDone ? "rgba(244,83,60,0.15)" : "var(--color-fd-border)"
                }`,
                background: isActive ? "rgba(244,83,60,0.06)" : isDone ? "rgba(244,83,60,0.025)" : "transparent",
                boxShadow: isActive ? "0 0 12px rgba(244,83,60,0.08)" : "none",
                transition: "all 0.4s ease",
                opacity: isDone || isActive ? 1 : 0.55,
              }}
            >
              {/* Step number */}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  background: isActive ? ACCENT : isDone ? "rgba(244,83,60,0.2)" : "rgba(255,255,255,0.05)",
                  color: isActive ? "#fff" : isDone ? "rgba(244,83,60,0.8)" : "var(--color-fd-muted-foreground)",
                  transition: "all 0.4s ease",
                  marginTop: 1,
                }}
              >
                {step.n}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: isActive || isDone ? "var(--color-fd-foreground)" : "var(--color-fd-muted-foreground)",
                      transition: "color 0.4s ease",
                    }}
                  >
                    {step.label}
                  </div>
                  {isActive && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: ACCENT,
                        animation: "slackPing 1s ease-in-out infinite",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    lineHeight: 1.4,
                    color: "var(--color-fd-muted-foreground)",
                    opacity: isActive ? 1 : isDone ? 0.7 : 0.5,
                    transition: "opacity 0.4s ease",
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 16,
          height: 2,
          borderRadius: 2,
          background: "var(--color-fd-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: `linear-gradient(90deg, ${ACCENT}, rgba(244,83,60,0.4))`,
            width: `${((active + 1) / STEPS.length) * 100}%`,
            transition: "width 0.4s ease",
            borderRadius: 2,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontFamily: "monospace",
          color: "var(--color-fd-muted-foreground)",
          textAlign: "right",
          opacity: 0.6,
        }}
      >
        step {active + 1} / {STEPS.length}
      </div>
    </div>
  );
}
