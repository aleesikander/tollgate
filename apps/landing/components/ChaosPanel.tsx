"use client";

import { useEffect, useState } from "react";

const EVENTS = [
  { id: 1, action: "issue_refund",        detail: "$30 · c_001",          amount: 30,     latency: 14, level: 0 },
  { id: 2, action: "issue_refund",        detail: "$45 · c_002",          amount: 45,     latency: 12, level: 0 },
  { id: 3, action: "issue_refund",        detail: "$220 · c_003",         amount: 220,    latency: 11, level: 1 },
  { id: 4, action: "cancel_subscription", detail: "acme-corp · 48 seats", amount: 0,      latency: 9,  level: 1 },
  { id: 5, action: "issue_refund",        detail: "$850 · c_004",         amount: 850,    latency: 13, level: 2 },
  { id: 6, action: "issue_refund",        detail: "$2,400 · c_005",       amount: 2400,   latency: 12, level: 2 },
  { id: 7, action: "issue_refund",        detail: "$11,200 · c_006",      amount: 11200,  latency: 8,  level: 2 },
];

const LEVEL_COLORS = ["#5BD982", "#F59E0B", "#EF4444"];
const MAX_DAMAGE = EVENTS.reduce((s, e) => s + e.amount, 0);
const STEP_MS = 1500;
const HOLD_MS = 4500;

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ChaosPanel() {
  const [shown, setShown] = useState<number[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];

    function run() {
      setShown([]);
      setTotal(0);
      setDone(false);
      setFade(false);

      EVENTS.forEach((ev, i) => {
        ts.push(setTimeout(() => {
          setShown(p => [...p, ev.id]);
          if (ev.amount > 0) setTotal(p => p + ev.amount);
        }, i * STEP_MS));
      });

      const endT = EVENTS.length * STEP_MS + 400;
      ts.push(setTimeout(() => setDone(true), endT));
      ts.push(setTimeout(() => setFade(true), endT + HOLD_MS));
      ts.push(setTimeout(run, endT + HOLD_MS + 700));
    }

    run();
    return () => ts.forEach(clearTimeout);
  }, []);

  const dmg = Math.min(total / MAX_DAMAGE, 1);
  const glowOpacity = 0.04 + dmg * 0.22;
  const glowRadius = 20 + dmg * 70;

  return (
    <div style={{ opacity: fade ? 0 : 1, transition: "opacity 0.7s" }} className="w-full">
      <div
        className="rounded-tg-xl overflow-hidden w-full bg-surface-1"
        style={{
          border: `1px solid rgba(255,255,255,${0.06 + dmg * 0.06})`,
          boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03), 0 0 ${glowRadius}px rgba(239,68,68,${glowOpacity})`,
          transition: "box-shadow 1.8s ease",
        }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#EF4444" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#F59E0B" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#22C55E" }} />
            <span className="ml-2 text-mono-sm text-tertiary">support-bot · production</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#EF4444", animation: "tg-pulse 1.2s ease-in-out infinite" }}
              />
              <span className="text-mono-sm font-medium" style={{ color: "#EF4444" }}>LIVE</span>
            </div>
            <span
              className="text-mono-sm px-2 py-0.5 rounded"
              style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              no policy
            </span>
          </div>
        </div>

        {/* Feed */}
        <div className="px-4 py-4 flex flex-col gap-2" style={{ minHeight: 300 }}>
          {EVENTS.map((ev) => {
            const visible = shown.includes(ev.id);
            const color = LEVEL_COLORS[ev.level];
            return (
              <div
                key={ev.id}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 0.35s ease, transform 0.35s ease",
                }}
              >
                <div
                  className="flex items-center justify-between py-2.5 pr-3 rounded-tg-md overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    paddingLeft: 0,
                  }}
                >
                  {/* severity stripe */}
                  <div
                    className="self-stretch w-0.5 shrink-0 mr-3"
                    style={{ background: color, opacity: 0.7 }}
                  />
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="text-mono-sm text-secondary shrink-0">{ev.action}</span>
                    <span className="text-mono-sm text-tertiary truncate">{ev.detail}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-mono-sm text-tertiary">{ev.latency}ms</span>
                    <span className="text-mono-sm font-medium" style={{ color }}>✓ allowed</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total bar */}
        <div
          className="flex items-center justify-between px-5 py-4 border-t"
          style={{
            borderColor: done ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)",
            background: done ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.01)",
            transition: "border-color 1s, background 1s",
          }}
        >
          <span className="text-mono-sm text-tertiary tracking-wide">total refunded</span>
          <span
            className="font-bold tabular-nums"
            style={{
              fontSize: 16,
              color: total > 1000 ? "#EF4444" : total > 200 ? "#F59E0B" : "#5BD982",
              transition: "color 0.8s",
              letterSpacing: "-0.02em",
            }}
          >
            {fmt(total)}
          </span>
        </div>
      </div>

      <p
        className="text-center text-body-sm mt-5 tracking-wider uppercase"
        style={{
          opacity: done ? 1 : 0,
          transition: "opacity 0.6s",
          color: "rgba(239,68,68,0.6)",
          letterSpacing: "0.12em",
          fontSize: 11,
        }}
      >
        No policy&nbsp;·&nbsp;No approval&nbsp;·&nbsp;No limit
      </p>
    </div>
  );
}
