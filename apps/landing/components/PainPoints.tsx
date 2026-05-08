"use client";

import { useState } from "react";

const PAINS = [
  {
    stat: "$40k",
    title: "One bad prompt. $40,000 gone.",
    body: "A misunderstood request, an edge case your policy doesn't cover, a prompt injection from a malicious customer — and your refund agent processes hundreds of requests before anyone notices. There's no undo.",
    accent: "#EF4444",
    rgb: "239,68,68",
  },
  {
    stat: "0 logs",
    title: "You can't audit what you can't see.",
    body: "When a customer complains their subscription was cancelled wrongly, can you show exactly what the agent decided and why? Without a full audit trail, you're guessing — and your compliance team is not ok with that.",
    accent: "#F59E0B",
    rgb: "245,158,11",
  },
  {
    stat: "2 weeks",
    title: "Human approval shouldn't require a dashboard.",
    body: "Your team lives in Slack. Building a custom approval UI, wiring up webhooks, managing state across agent restarts — that's weeks of engineering for something that should take an afternoon.",
    accent: "#F4533C",
    rgb: "244,83,60",
  },
];

export function PainPoints() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="py-28 border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">

        <div className="mb-16 max-w-[520px]">
          <p className="text-micro uppercase tracking-[0.1em] mb-4 text-tertiary">The problem</p>
          <h2 className="text-display-md font-semibold leading-[1.05] tracking-[-0.025em]">
            Every team shipping a support agent<br />hits the same three walls.
          </h2>
        </div>

        <div>
          {PAINS.map((p, i) => {
            const on = hovered === i;
            return (
              <div key={p.title}>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className="relative flex gap-6 md:gap-10 items-start py-8 md:py-9 cursor-default pl-4"
                  style={{
                    background: on ? "rgba(255,255,255,0.018)" : "transparent",
                    transition: "background 0.2s ease",
                  }}
                >
                  {/* Left accent bar */}
                  <div
                    className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full"
                    style={{
                      background: p.accent,
                      opacity: on ? 0.8 : 0,
                      transition: "opacity 0.25s ease",
                    }}
                  />

                  {/* Index */}
                  <span
                    className="hidden md:block text-mono-sm shrink-0 w-6 pt-1"
                    style={{ color: "rgba(255,255,255,0.2)" }}
                  >
                    0{i + 1}
                  </span>

                  {/* Stat */}
                  <span
                    className="font-bold tabular-nums shrink-0 leading-none pt-0.5"
                    style={{
                      fontSize: 28,
                      letterSpacing: "-0.03em",
                      width: 130,
                      color: on ? p.accent : `rgba(${p.rgb}, 0.65)`,
                      transition: "color 0.25s ease",
                    }}
                  >
                    {p.stat}
                  </span>

                  {/* Title */}
                  <h3
                    className="font-semibold shrink-0 leading-snug hidden md:block"
                    style={{
                      fontSize: 17,
                      width: 280,
                      color: on ? "#fff" : "rgba(255,255,255,0.8)",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {p.title}
                  </h3>

                  {/* Right col: title (mobile) + body */}
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <h3
                      className="font-semibold leading-snug md:hidden"
                      style={{ fontSize: 17 }}
                    >
                      {p.title}
                    </h3>
                    <p
                      className="text-body-md leading-[1.75]"
                      style={{ color: on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.38)", transition: "color 0.2s ease" }}
                    >
                      {p.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

      </div>
    </section>
  );
}
