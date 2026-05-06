"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// phase 0: notification visible, idle
// phase 1: approve button being clicked
// phase 2: approved state
// phase 3: brief blank reset
const DURATIONS = [2400, 450, 2600, 300];

export function AnimatedSlackApproval() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p + 1) % 4), DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const SlackIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M9.6 2.4a2.4 2.4 0 1 0 0 4.8H12V2.4H9.6z" fill="#E01E5A" />
      <path d="M14.4 2.4a2.4 2.4 0 1 1 0 4.8H12V2.4h2.4z" fill="#36C5F0" />
      <path d="M2.4 9.6a2.4 2.4 0 1 0 4.8 0V7.2H2.4v2.4z" fill="#2EB67D" />
      <path d="M2.4 14.4a2.4 2.4 0 1 1 4.8 0V12H2.4v2.4z" fill="#ECB22E" />
      <path d="M9.6 21.6a2.4 2.4 0 1 0 0-4.8H7.2v4.8H9.6z" fill="#ECB22E" />
      <path d="M14.4 21.6a2.4 2.4 0 1 1 0-4.8H12v4.8h2.4z" fill="#2EB67D" />
      <path d="M21.6 9.6a2.4 2.4 0 1 1-4.8 0V7.2h4.8V9.6z" fill="#36C5F0" />
      <path d="M21.6 14.4a2.4 2.4 0 1 0-4.8 0V12h4.8v2.4z" fill="#E01E5A" />
    </svg>
  );

  return (
    <div className="rounded-tg-lg border border-border-default overflow-hidden bg-surface-2">
      {/* Slack channel bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111115] border-b border-border-subtle">
        <SlackIcon />
        <span className="text-mono-sm text-tertiary">#approvals</span>
        <span className="ml-auto text-mono-sm text-quaternary">support-bot</span>
      </div>

      {/* Message body */}
      <div
        className="p-4 transition-opacity duration-200"
        style={{ opacity: phase === 3 ? 0 : 1, minHeight: 196 }}
      >
        <div className="flex items-start gap-2.5">
          {/* Bot avatar */}
          <div className="w-7 h-7 rounded bg-accent-bg border border-accent-border flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[9px] font-bold text-accent">TG</span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Author + timestamp */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-body-sm font-semibold text-primary">Tollgate</span>
              <span className="text-mono-sm text-quaternary">App · 11:47 AM</span>
            </div>

            {phase <= 1 ? (
              /* Pending state */
              <div className="rounded-tg-md border border-accent-border bg-accent-bg p-3 space-y-2.5">
                <p className="text-body-sm font-medium text-primary">🔔 Approval required</p>

                <div className="space-y-1.5">
                  {[
                    ["Action", "issue_refund", true],
                    ["Amount", "$1,200.00", false],
                    ["Customer", "c_002 · acme-corp", false],
                    ["Policy", "exceeds auto-approve limit ($500)", false],
                  ].map(([k, v, mono]) => (
                    <div key={String(k)} className="flex gap-3 text-body-sm">
                      <span className="text-tertiary w-16 shrink-0">{k}</span>
                      <span className={`text-secondary ${mono ? "font-mono" : ""}`}>{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    className="flex-1 py-1.5 rounded-tg-sm text-body-sm font-medium text-white transition-all duration-150"
                    style={{
                      background: "#1f7a3f",
                      transform: phase === 1 ? "scale(0.93)" : "scale(1)",
                      opacity: phase === 1 ? 0.75 : 1,
                    }}
                  >
                    Approve
                  </button>
                  <button className="flex-1 py-1.5 rounded-tg-sm text-body-sm font-medium text-secondary border border-border-default">
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              /* Approved state */
              <div className="rounded-tg-md border border-success-border bg-success-bg p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-success" strokeWidth={2.5} />
                  <p className="text-body-sm font-medium text-primary">Approved by Alice M.</p>
                </div>
                <div className="space-y-1.5">
                  {[
                    ["Action", "issue_refund", true],
                    ["Amount", "$1,200.00 · refund processed", false],
                    ["Agent", "support-bot · production", false],
                  ].map(([k, v, mono]) => (
                    <div key={String(k)} className="flex gap-3 text-body-sm">
                      <span className="text-tertiary w-16 shrink-0">{k}</span>
                      <span className={`text-secondary ${mono ? "font-mono" : ""}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
