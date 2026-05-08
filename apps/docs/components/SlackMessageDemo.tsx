"use client";

import { useEffect, useState } from "react";

type Phase = "hidden" | "arriving" | "waiting" | "clicking" | "approved" | "fade";

export function SlackMessageDemo() {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];

    function run() {
      setPhase("hidden");
      ts.push(setTimeout(() => setPhase("arriving"), 600));
      ts.push(setTimeout(() => setPhase("waiting"),  1300));
      ts.push(setTimeout(() => setPhase("clicking"), 4200));
      ts.push(setTimeout(() => setPhase("approved"), 4700));
      ts.push(setTimeout(() => setPhase("fade"),     8400));
      ts.push(setTimeout(run,                        9200));
    }

    run();
    return () => ts.forEach(clearTimeout);
  }, []);

  const visible = phase !== "hidden" && phase !== "fade";

  return (
    <div
      className="not-prose"
      style={{ margin: "24px 0" }}
    >
      <style>{`
        @keyframes slackFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#1a1d21",
          overflow: "hidden",
          opacity: phase === "fade" ? 0 : phase === "hidden" ? 0 : 1,
          transform: phase === "hidden" ? "translateY(6px)" : "translateY(0)",
          transition: "opacity 0.45s ease, transform 0.45s ease",
        }}
      >
        {/* Channel header */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5 }}>
            <path d="M9.6 2.4a2.4 2.4 0 1 0 0 4.8H12V2.4H9.6z" fill="#E01E5A"/>
            <path d="M14.4 2.4a2.4 2.4 0 1 1 0 4.8H12V2.4h2.4z" fill="#36C5F0"/>
            <path d="M2.4 9.6a2.4 2.4 0 1 0 4.8 0V7.2H2.4v2.4z" fill="#2EB67D"/>
            <path d="M2.4 14.4a2.4 2.4 0 1 1 4.8 0V12H2.4v2.4z" fill="#ECB22E"/>
            <path d="M9.6 21.6a2.4 2.4 0 1 0 0-4.8H7.2v4.8H9.6z" fill="#ECB22E"/>
            <path d="M14.4 21.6a2.4 2.4 0 1 1 0-4.8H12v4.8h2.4z" fill="#2EB67D"/>
            <path d="M21.6 9.6a2.4 2.4 0 1 1-4.8 0V7.2h4.8V9.6z" fill="#36C5F0"/>
            <path d="M21.6 14.4a2.4 2.4 0 1 0-4.8 0V12h4.8v2.4z" fill="#E01E5A"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e8e8e8" }}>approvals</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "monospace",
            }}
          >
            2 members
          </span>
        </div>

        {/* Message body */}
        <div
          style={{
            padding: "16px 16px 20px",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.35s ease, transform 0.35s ease",
          }}
        >
          {/* Sender row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 7,
                background: "#F4533C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              T
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#e8e8e8" }}>Tollgate</span>
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  marginLeft: 8,
                  fontFamily: "monospace",
                }}
              >
                Today at 14:03
              </span>
            </div>
          </div>

          {/* Attachment */}
          <div
            style={{
              marginLeft: 44,
              borderLeft: "4px solid #F4533C",
              borderRadius: "0 8px 8px 0",
              background: "rgba(255,255,255,0.03)",
              padding: "12px 16px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#e8e8e8",
                margin: "0 0 10px",
              }}
            >
              🔔 Approval required — support-bot
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
              {[
                ["Action",   "issue_refund"],
                ["Amount",   "$75.00"],
                ["Customer", "cus_abc123"],
                ["Reason",   "Item arrived damaged"],
                ["Expires",  "5 minutes"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "rgba(255,255,255,0.35)",
                      width: 68,
                      flexShrink: 0,
                    }}
                  >
                    {k}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "rgba(255,255,255,0.72)",
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {/* Buttons / result */}
            {phase !== "approved" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{
                    padding: "7px 18px",
                    borderRadius: 5,
                    fontSize: 13,
                    fontWeight: 600,
                    background: phase === "clicking" ? "#2EB67D" : "#1a6e38",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    transform: phase === "clicking" ? "scale(0.94)" : "scale(1)",
                    transition: "background 0.2s, transform 0.12s",
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  style={{
                    padding: "7px 18px",
                    borderRadius: 5,
                    fontSize: 13,
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                  }}
                >
                  ✗ Reject
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 14px",
                    borderRadius: 5,
                    background: "rgba(46,182,125,0.1)",
                    border: "1px solid rgba(46,182,125,0.25)",
                    animation: "slackFadeUp 0.35s ease",
                  }}
                >
                  <span
                    style={{ fontSize: 13, color: "#2EB67D", fontWeight: 600 }}
                  >
                    ✓ Approved by ali@company.com
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "rgba(255,255,255,0.3)",
                    animation: "slackFadeUp 0.4s ease 0.25s both",
                  }}
                >
                  → Stripe refund executed · $75.00 · ref_abc9x1
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
