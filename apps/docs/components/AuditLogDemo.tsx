"use client";

import { useEffect, useState } from "react";

const ROWS = [
  { action: "issue_refund",        amount: "$30",  decision: "allowed",  by: "policy",             time: "14:02:01", color: "#22c55e" },
  { action: "issue_refund",        amount: "$75",  decision: "approved", by: "ali@company.com",    time: "14:03:47", color: "#F4533C" },
  { action: "issue_refund",        amount: "$750", decision: "denied",   by: "policy",             time: "14:05:12", color: "#ef4444" },
  { action: "cancel_subscription", amount: "—",    decision: "approved", by: "sam@company.com",    time: "14:11:03", color: "#F4533C" },
];

const STEP_MS  = 1300;
const HOLD_MS  = 2200;

export function AuditLogDemo() {
  const [shown, setShown]   = useState(0);
  const [faded, setFaded]   = useState(false);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];

    function run() {
      setShown(0);
      setFaded(false);

      ROWS.forEach((_, i) => {
        ts.push(setTimeout(() => setShown(i + 1), (i + 1) * STEP_MS));
      });

      const end = ROWS.length * STEP_MS + HOLD_MS;
      ts.push(setTimeout(() => setFaded(true), end));
      ts.push(setTimeout(run, end + 700));
    }

    run();
    return () => ts.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="not-prose"
      style={{
        margin: "24px 0",
        borderRadius: 12,
        border: "1px solid var(--color-fd-border)",
        background: "var(--color-fd-card)",
        overflow: "hidden",
        opacity: faded ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      <style>{`
        @keyframes auditPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.5); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 72px 110px 1fr 72px",
          gap: "0 12px",
          padding: "10px 16px",
          borderBottom: "1px solid var(--color-fd-border)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {["Action", "Amount", "Decision", "Decided by", "Time"].map((h) => (
          <span
            key={h}
            style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "monospace",
              letterSpacing: "0.07em",
              color: "var(--color-fd-muted-foreground)",
              textTransform: "uppercase",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {ROWS.map((row, i) => {
        const visible = shown > i;
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 72px 110px 1fr 72px",
              gap: "0 12px",
              padding: "11px 16px",
              borderBottom:
                i < ROWS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(5px)",
              transition: "opacity 0.35s ease, transform 0.35s ease",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--color-fd-foreground)",
              }}
            >
              {row.action}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--color-fd-foreground)",
              }}
            >
              {row.amount}
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: `${row.color}18`,
                  color: row.color,
                  border: `1px solid ${row.color}35`,
                }}
              >
                {row.decision}
              </span>
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--color-fd-muted-foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.by}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--color-fd-muted-foreground)",
                opacity: 0.7,
              }}
            >
              {row.time}
            </span>
          </div>
        );
      })}

      {/* Footer */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--color-fd-border)",
          background: "rgba(255,255,255,0.01)",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22c55e",
            display: "inline-block",
            flexShrink: 0,
            animation: "auditPulse 1.6s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            color: "var(--color-fd-muted-foreground)",
          }}
        >
          Live · {shown} of {ROWS.length} events
        </span>
      </div>
    </div>
  );
}
