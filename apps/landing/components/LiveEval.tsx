"use client";

import { useEffect, useRef, useState } from "react";

/* ── Data ─────────────────────────────────────────────────────── */

const RULES = [
  {
    ruleIdx: 0,
    decide: "allow",
    decideColor: "#5BD982",
    lines: [
      { type: "key-val", indent: 2, bullet: true,  key: "action",  val: " issue_refund" },
      { type: "key",     indent: 4, bullet: false, key: "when",    val: "" },
      { type: "key-val", indent: 6, bullet: false, key: "amount",  val: " { lte: 50 }" },
      { type: "key-val", indent: 4, bullet: false, key: "decide",  val: " allow", colored: true },
    ],
  },
  {
    ruleIdx: 1,
    decide: "require_approval",
    decideColor: "#F4533C",
    lines: [
      { type: "key-val", indent: 2, bullet: true,  key: "action",    val: " issue_refund" },
      { type: "key",     indent: 4, bullet: false, key: "when",      val: "" },
      { type: "key-val", indent: 6, bullet: false, key: "amount",    val: " { lte: 500 }" },
      { type: "key-val", indent: 4, bullet: false, key: "decide",    val: " require_approval", colored: true },
      { type: "key-val", indent: 4, bullet: false, key: "approvers", val: ' ["#approvals"]' },
    ],
  },
  {
    ruleIdx: 2,
    decide: "deny",
    decideColor: "#ef4444",
    lines: [
      { type: "key-val", indent: 2, bullet: true,  key: "action", val: " delete_account" },
      { type: "key-val", indent: 4, bullet: false, key: "decide", val: " deny", colored: true },
      { type: "key-val", indent: 4, bullet: false, key: "reason", val: ' "Manual only"' },
    ],
  },
];

const ACTION_SEQUENCE = [
  { name: "issue_refund",   detail: "$30 · cus_001",      decision: "allowed",  ms: "0.8", ruleIdx: 0 },
  { name: "send_email",     detail: "to: alice@corp.com", decision: "allowed",  ms: "0.5", ruleIdx: -1 },
  { name: "issue_refund",   detail: "$250 · cus_002",     decision: "pending",  ms: "0.9", ruleIdx: 1 },
  { name: "delete_account", detail: "cus_003",             decision: "denied",   ms: "0.6", ruleIdx: 2 },
  { name: "export_data",    detail: "Q1-2025.csv",         decision: "allowed",  ms: "0.4", ruleIdx: -1 },
  { name: "issue_refund",   detail: "$800 · cus_005",     decision: "pending",  ms: "1.1", ruleIdx: 1 },
  { name: "cancel_order",   detail: "ord_789",             decision: "allowed",  ms: "0.7", ruleIdx: -1 },
  { name: "delete_account", detail: "cus_006",             decision: "denied",   ms: "0.8", ruleIdx: 2 },
  { name: "issue_refund",   detail: "$45 · cus_007",      decision: "allowed",  ms: "0.6", ruleIdx: 0 },
];

interface ActionItem {
  id: number;
  name: string;
  detail: string;
  decision: string;
  ms: string;
  ruleIdx: number;
  isNew: boolean;
}

function badge(decision: string) {
  if (decision === "allowed") return { symbol: "✓ allowed",  color: "#5BD982", bg: "rgba(91,217,130,0.08)",  border: "rgba(91,217,130,0.22)" };
  if (decision === "pending") return { symbol: "⏳ pending", color: "#F4533C", bg: "rgba(244,83,60,0.08)",   border: "rgba(244,83,60,0.22)" };
  return                             { symbol: "✗ denied",   color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.22)" };
}

/* ── Component ────────────────────────────────────────────────── */

export function LiveEval() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [highlightRule, setHighlightRule] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const seqRef = useRef(0);
  const idRef = useRef(0);
  const hlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Seed with initial items (no animation)
    const seed = ACTION_SEQUENCE.slice(0, 4).map((a) => ({
      ...a,
      id: idRef.current++,
      isNew: false,
    }));
    setItems(seed);
    setTotalCount(seed.length);
    seqRef.current = seed.length;

    const interval = setInterval(() => {
      const action = ACTION_SEQUENCE[seqRef.current % ACTION_SEQUENCE.length];
      seqRef.current++;

      const newId = idRef.current++;
      const newItem: ActionItem = { ...action, id: newId, isNew: true };

      // Highlight matching rule
      if (action.ruleIdx >= 0) {
        if (hlTimer.current) clearTimeout(hlTimer.current);
        setHighlightRule(action.ruleIdx);
        hlTimer.current = setTimeout(() => setHighlightRule(null), 900);
      }

      setItems((prev) => [...prev.slice(-4), newItem]);
      setTotalCount((n) => n + 1);

      // Clear isNew after animation completes so it doesn't re-fire on re-render
      setTimeout(() => {
        setItems((prev) =>
          prev.map((it) => (it.id === newId ? { ...it, isNew: false } : it))
        );
      }, 500);
    }, 2200);

    return () => {
      clearInterval(interval);
      if (hlTimer.current) clearTimeout(hlTimer.current);
    };
  }, []);

  return (
    <section className="py-28 border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-micro uppercase text-tertiary tracking-[0.04em] mb-3">Decision engine</p>
          <h2 className="text-display-md font-medium leading-[1.05] tracking-[-0.025em] max-w-[540px] mx-auto">
            Every action evaluated. Before it runs.
          </h2>
          <p className="text-body-lg text-secondary mt-4 max-w-[500px] mx-auto leading-[1.65]">
            Write a YAML policy. Tollgate intercepts every tool call and returns a decision in under 50ms — allow, deny, or hold for human approval.
          </p>
        </div>

        {/* Demo card */}
        <div
          className="rounded-tg-xl border border-border-default overflow-hidden"
          style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.03)" }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-surface-2 border-b border-border-subtle">
            <span className="w-3 h-3 rounded-full bg-border-strong" />
            <span className="w-3 h-3 rounded-full bg-border-strong" />
            <span className="w-3 h-3 rounded-full bg-border-strong" />
            <span className="ml-2 text-mono-sm text-tertiary">policy engine</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" style={{ animation: "tg-pulse 1.4s ease-in-out infinite" }} />
              <span className="text-mono-sm text-success">live</span>
            </div>
          </div>

          {/* Two panels */}
          <div className="grid md:grid-cols-[1fr_1.45fr]">

            {/* LEFT: Policy */}
            <div className="p-6 bg-surface-1 border-b md:border-b-0 md:border-r border-border-subtle">
              <p className="text-mono-sm uppercase tracking-[0.04em] text-tertiary mb-5">policy.yaml</p>
              <div className="font-mono text-mono-md leading-[1.7] select-none">
                <p>
                  <span className="text-accent-soft">version</span>
                  <span className="text-border-strong">:</span>
                  <span className="text-secondary"> 1</span>
                </p>
                <p className="mt-1">
                  <span className="text-accent-soft">rules</span>
                  <span className="text-border-strong">:</span>
                </p>

                {RULES.map((rule) => {
                  const isActive = highlightRule === rule.ruleIdx;
                  return (
                    <div
                      key={rule.ruleIdx}
                      className="mt-2 pl-1 rounded-sm transition-all duration-300"
                      style={{
                        borderLeft: `2px solid ${isActive ? rule.decideColor : "transparent"}`,
                        background: isActive ? `${rule.decideColor}0d` : "transparent",
                        paddingLeft: isActive ? "6px" : "2px",
                      }}
                    >
                      {rule.lines.map((line, li) => {
                        const indentStr = " ".repeat(line.indent);
                        const isDecide = line.key === "decide";
                        return (
                          <p key={li}>
                            {line.bullet
                              ? <><span className="text-tertiary">{" ".repeat(line.indent - 2)}- </span><span className="text-accent-soft">{line.key}</span></>
                              : <><span className="text-tertiary">{indentStr}</span><span className="text-accent-soft">{line.key}</span></>
                            }
                            {line.val && (
                              <>
                                <span className="text-border-strong">:</span>
                                <span style={{ color: isDecide ? rule.decideColor : undefined }} className={isDecide ? "font-medium" : "text-secondary"}>
                                  {line.val}
                                </span>
                              </>
                            )}
                            {!line.val && <span className="text-border-strong">:</span>}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}

                <p className="mt-3">
                  <span className="text-accent-soft">default</span>
                  <span className="text-border-strong">:</span>
                  <span className="text-secondary"> allow</span>
                </p>
              </div>
            </div>

            {/* RIGHT: Live feed */}
            <div className="p-6 bg-surface-2">
              <div className="flex items-center justify-between mb-5">
                <p className="text-mono-sm uppercase tracking-[0.04em] text-tertiary">Agent activity</p>
                <p className="text-mono-sm text-quaternary tabular-nums">{totalCount} evaluated</p>
              </div>

              <div className="flex flex-col gap-2" style={{ minHeight: 230 }}>
                {items.map((item) => {
                  const b = badge(item.decision);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-tg-md px-3 py-2.5 border border-border-subtle bg-surface-1"
                      style={{
                        animation: item.isNew ? "tg-fadein-up 0.35s ease forwards" : "none",
                        opacity: item.isNew ? 0 : 1,
                      }}
                    >
                      {/* Decision badge */}
                      <span
                        className="text-mono-sm font-medium shrink-0 px-2 py-0.5 rounded-tg-sm"
                        style={{
                          color: b.color,
                          background: b.bg,
                          border: `1px solid ${b.border}`,
                          minWidth: 76,
                          textAlign: "center",
                          fontSize: 10.5,
                        }}
                      >
                        {b.symbol}
                      </span>

                      {/* Action name */}
                      <span className="text-mono-sm text-primary font-medium shrink-0">
                        {item.name}
                      </span>

                      {/* Detail */}
                      <span className="text-mono-sm text-tertiary flex-1 truncate">
                        {item.detail}
                      </span>

                      {/* Latency */}
                      <span className="text-mono-sm text-quaternary shrink-0">{item.ms}ms</span>
                    </div>
                  );
                })}
              </div>

              {/* Blinking cursor — visual flair */}
              <div className="flex items-center gap-1.5 mt-3">
                <span className="text-mono-sm text-quaternary">›</span>
                <span
                  className="inline-block w-[6px] h-[13px] bg-accent-soft rounded-sm opacity-60"
                  style={{ animation: "tg-blink 1.1s step-end infinite" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom stat strip */}
        <div className="flex items-center justify-center gap-10 mt-10 flex-wrap">
          {[
            ["< 50ms", "median decision latency"],
            ["100%", "action coverage"],
            ["0 code changes", "to your agent"],
          ].map(([val, label]) => (
            <div key={label} className="text-center">
              <p className="text-display-md font-medium tracking-[-0.025em] text-primary leading-none">{val}</p>
              <p className="text-body-sm text-tertiary mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
