"use client";

import { useEffect, useRef, useState } from "react";

// Keeps the typed text on screen when active goes false (don't clear on deactivate)
function useTyping(text: string, active: boolean, speed = 28) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) return;
    setOut("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [active, text, speed]);
  return out;
}

const STEPS = [
  { id: 1, label: "Create agent"  },
  { id: 2, label: "Write policy"  },
  { id: 3, label: "Add SDK"       },
  { id: 4, label: "Get approval"  },
];

const POLICY = `version: 1
rules:
  - action: issue_refund
    when:
      amount: { lte: 50 }
    decide: allow

  - action: issue_refund
    when:
      amount: { gt: 50 }
    decide: require_approval
    approvers:
      - "#approvals"

  - action: cancel_subscription
    decide: require_approval
    approvers:
      - "#approvals"

default: allow`;

const SDK_CODE = `from tollgate import Tollgate

tg = Tollgate(api_key=os.environ["TOLLGATE_API_KEY"])

@tg.guard("issue_refund")
def issue_refund(amount: float, customer_id: str):
    # only runs if policy allows
    stripe.refund(customer_id, amount)`;

// Timing (ms) — generous pauses so users can read each step
const S1_TYPING = 1800;
const S1_HOLD   = 2600;
const FADE      = 320;   // cross-fade between steps
const S2_TYPING = 5200;  // ~200 chars × 18ms ≈ 3.6s + 1.6s padding
const S2_HOLD   = 2200;
const S3_TYPING = 5800;  // ~190 chars × 22ms ≈ 4.2s + 1.6s padding
const S3_HOLD   = 2200;
const S4_ARRIVE = 1400;
const S4_HOLD   = 4800;
const RESET_MS  = 900;

type Phase =
  | "s1_typing" | "s1_done"
  | "s2_typing" | "s2_done"
  | "s3_typing" | "s3_done"
  | "s4_arriving" | "s4_approved" | "s4_done"
  | "fade";

function phaseToStep(p: Phase): number {
  if (p.startsWith("s1")) return 1;
  if (p.startsWith("s2")) return 2;
  if (p.startsWith("s3")) return 3;
  return 4;
}

// ─── step panels ──────────────────────────────────────────────

function Step1Panel({ phase }: { phase: Phase }) {
  const agentName = useTyping("support-bot", phase === "s1_typing", 70);
  const showKey = phase === "s1_done";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-tertiary">New agent</p>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-tg-md text-body-sm font-medium"
          style={{ background: "rgba(244,83,60,0.15)", color: "#F4533C", border: "1px solid rgba(244,83,60,0.2)" }}
        >
          Agents / Create
        </div>
      </div>

      <div className="rounded-tg-lg border border-border-default bg-surface-2 p-5 flex flex-col gap-5">
        <p className="text-heading-md font-medium">Create agent</p>

        <div className="flex flex-col gap-1.5">
          <p className="text-body-sm text-tertiary">Agent name</p>
          <div
            className="rounded-tg-md border border-border-default bg-surface-1 px-3 py-2.5 text-mono-sm text-primary flex items-center gap-1"
            style={{ minHeight: 38 }}
          >
            <span style={{ color: "#F4533C" }}>›</span>
            <span className="ml-1">{agentName}</span>
            {phase === "s1_typing" && (
              <span
                className="inline-block w-[6px] h-[14px] rounded-sm"
                style={{ background: "#F4533C", animation: "tg-blink 1.1s step-end infinite" }}
              />
            )}
          </div>
        </div>

        <div
          style={{
            opacity: showKey ? 1 : 0,
            transform: showKey ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
            borderRadius: 10,
            border: "1px solid rgba(91,217,130,0.2)",
            background: "rgba(91,217,130,0.04)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-tertiary">API key — shown once</p>
            <span className="text-mono-sm px-2 py-0.5 rounded" style={{ background: "rgba(91,217,130,0.1)", color: "#5BD982" }}>✓ created</span>
          </div>
          <p className="text-mono-sm" style={{ color: "#5BD982", letterSpacing: "0.04em" }}>
            tg_live_sk_sk_xxxxxxxxxxxxxxxxxxxx
          </p>
        </div>
      </div>
    </div>
  );
}

function Step2Panel({ phase }: { phase: Phase }) {
  const active = phase === "s2_typing" || phase === "s2_done";
  const code = useTyping(POLICY, phase === "s2_typing", 18);
  const saved = phase === "s2_done";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-tertiary">policy.yaml</p>
        <span
          className="text-mono-sm px-2 py-0.5 rounded"
          style={{
            background: "rgba(91,217,130,0.1)",
            color: "#5BD982",
            border: "1px solid rgba(91,217,130,0.2)",
            opacity: saved ? 1 : 0,
            transition: "opacity 0.4s",
          }}
        >
          ✓ saved
        </span>
      </div>
      <div
        className="rounded-tg-lg border border-border-default bg-[#0d0d0d] px-4 py-4 overflow-hidden"
        style={{ minHeight: 260, fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}
      >
        {active ? (
          <pre className="text-secondary whitespace-pre-wrap break-words m-0">
            {code}
            {!saved && (
              <span
                className="inline-block w-[6px] h-[13px] rounded-sm align-middle"
                style={{ background: "#F4533C", animation: "tg-blink 1.1s step-end infinite", marginLeft: 1 }}
              />
            )}
          </pre>
        ) : (
          <p className="text-tertiary m-0">Waiting…</p>
        )}
      </div>
    </div>
  );
}

function Step3Panel({ phase }: { phase: Phase }) {
  const active = phase === "s3_typing" || phase === "s3_done";
  const code = useTyping(SDK_CODE, phase === "s3_typing", 22);
  const done = phase === "s3_done";

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-tg-lg border border-border-default bg-[#0d0d0d] px-4 py-3 flex items-center gap-3"
        style={{ opacity: active ? 1 : 0.3, transition: "opacity 0.3s" }}
      >
        <span className="text-mono-sm" style={{ color: "#5BD982" }}>$</span>
        <span className="text-mono-sm text-tertiary">pip install tollgate-sdk</span>
        {active && (
          <span
            className="ml-auto text-mono-sm px-2 py-0.5 rounded"
            style={{ background: "rgba(91,217,130,0.1)", color: "#5BD982", border: "1px solid rgba(91,217,130,0.15)" }}
          >
            ✓ installed
          </span>
        )}
      </div>
      <div
        className="rounded-tg-lg border border-border-default bg-[#0d0d0d] px-4 py-4 overflow-hidden"
        style={{ minHeight: 220, fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}
      >
        {active ? (
          <pre className="text-secondary whitespace-pre-wrap break-words m-0">
            {code}
            {!done && (
              <span
                className="inline-block w-[6px] h-[13px] rounded-sm align-middle"
                style={{ background: "#F4533C", animation: "tg-blink 1.1s step-end infinite", marginLeft: 1 }}
              />
            )}
          </pre>
        ) : (
          <p className="text-tertiary m-0">Waiting…</p>
        )}
      </div>
    </div>
  );
}

function Step4Panel({ phase }: { phase: Phase }) {
  const arriving   = phase === "s4_arriving" || phase === "s4_approved" || phase === "s4_done";
  const approved   = phase === "s4_approved" || phase === "s4_done";

  return (
    <div className="flex flex-col gap-4">
      {/* agent paused indicator */}
      <div
        className="rounded-tg-md border px-4 py-3 flex items-center justify-between"
        style={{
          background: "rgba(245,158,11,0.04)",
          borderColor: "rgba(245,158,11,0.18)",
        }}
      >
        <div className="flex flex-col gap-0.5">
          <p className="text-mono-sm text-secondary">support-bot&nbsp; ·&nbsp; waiting for decision</p>
          <p className="text-body-sm text-tertiary">issue_refund · $250 · c_007</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#F59E0B", animation: "tg-pulse 1.4s ease-in-out infinite" }}
          />
          <span className="text-mono-sm" style={{ color: "#F59E0B" }}>paused</span>
        </div>
      </div>

      {/* slack message */}
      <div
        style={{
          opacity: arriving ? 1 : 0,
          transform: arriving ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
        className="rounded-tg-lg border border-border-default bg-surface-2 p-4 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 pb-1 border-b border-border-subtle">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9.6 2.4a2.4 2.4 0 1 0 0 4.8H12V2.4H9.6z" fill="#E01E5A"/>
            <path d="M14.4 2.4a2.4 2.4 0 1 1 0 4.8H12V2.4h2.4z" fill="#36C5F0"/>
            <path d="M2.4 9.6a2.4 2.4 0 1 0 4.8 0V7.2H2.4v2.4z" fill="#2EB67D"/>
            <path d="M2.4 14.4a2.4 2.4 0 1 1 4.8 0V12H2.4v2.4z" fill="#ECB22E"/>
            <path d="M9.6 21.6a2.4 2.4 0 1 0 0-4.8H7.2v4.8H9.6z" fill="#ECB22E"/>
            <path d="M14.4 21.6a2.4 2.4 0 1 1 0-4.8H12v4.8h2.4z" fill="#2EB67D"/>
            <path d="M21.6 9.6a2.4 2.4 0 1 1-4.8 0V7.2h4.8V9.6z" fill="#36C5F0"/>
            <path d="M21.6 14.4a2.4 2.4 0 1 0-4.8 0V12h4.8v2.4z" fill="#E01E5A"/>
          </svg>
          <span className="text-mono-sm text-tertiary">#approvals</span>
          <span className="ml-auto text-mono-sm text-tertiary">just now</span>
        </div>

        <div>
          <p className="text-body-sm font-medium text-primary mb-2">🔔 Approval required — support-bot</p>
          <div className="flex flex-col gap-1.5">
            {[["Action", "issue_refund"], ["Amount", "$250 · c_007"], ["Rule", "amount &gt; $50"]].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="text-mono-sm text-tertiary w-14 shrink-0">{k}</span>
                <span className="text-mono-sm text-secondary">{v.replace("&gt;", ">")}</span>
              </div>
            ))}
          </div>
        </div>

        {!approved ? (
          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 py-2 rounded-tg-md text-body-sm font-medium"
              style={{ background: "#1a5c30", color: "#5BD982", border: "1px solid rgba(91,217,130,0.2)" }}
            >
              Approve
            </button>
            <button
              className="flex-1 py-2 rounded-tg-md text-body-sm font-medium text-tertiary border border-border-default"
            >
              Reject
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-tg-md"
            style={{
              background: "rgba(91,217,130,0.08)",
              border: "1px solid rgba(91,217,130,0.22)",
              animation: "tg-fadein-up 0.4s ease",
            }}
          >
            <span className="text-lg" style={{ color: "#5BD982" }}>✓</span>
            <div>
              <p className="text-body-sm font-medium" style={{ color: "#5BD982" }}>Approved — refund processing</p>
              <p className="text-mono-sm text-tertiary mt-0.5">Agent resumed · 0.3s latency</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── captions ────────────────────────────────────────────────

const CAPTIONS: Record<number, string> = {
  1: "Create an agent. Copy your API key.",
  2: "Write a YAML policy. Small refunds auto-approve. Large ones wait for a human.",
  3: "One decorator wraps your function. Nothing else in your code changes.",
  4: "Agent blocks. Slack message fires. Human approves. Agent resumes.",
};

// ─── main ─────────────────────────────────────────────────────

export function JourneyDemo() {
  const [phase, setPhase]           = useState<Phase>("s1_typing");
  const [loopVisible, setLoopVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);
  const step = phaseToStep(phase);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];

    function crossfade(cb: () => void): void {
      setPanelVisible(false);
      ts.push(setTimeout(() => { cb(); setPanelVisible(true); }, FADE));
    }

    function run() {
      setLoopVisible(true);
      setPanelVisible(true);
      setPhase("s1_typing");

      let t = S1_TYPING;
      ts.push(setTimeout(() => setPhase("s1_done"), t));
      t += S1_HOLD;

      ts.push(setTimeout(() => crossfade(() => setPhase("s2_typing")), t));
      t += FADE + S2_TYPING;
      ts.push(setTimeout(() => setPhase("s2_done"), t));
      t += S2_HOLD;

      ts.push(setTimeout(() => crossfade(() => setPhase("s3_typing")), t));
      t += FADE + S3_TYPING;
      ts.push(setTimeout(() => setPhase("s3_done"), t));
      t += S3_HOLD;

      ts.push(setTimeout(() => crossfade(() => setPhase("s4_arriving")), t));
      t += FADE + S4_ARRIVE;
      ts.push(setTimeout(() => setPhase("s4_approved"), t));
      t += S4_HOLD;

      ts.push(setTimeout(() => setLoopVisible(false), t));
      t += RESET_MS;
      ts.push(setTimeout(run, t));
    }

    run();
    return () => ts.forEach(clearTimeout);
  }, []);

  return (
    <section className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">

        <div className="text-center mb-14">
          <p className="text-micro uppercase text-tertiary tracking-[0.04em] mb-3">How it works</p>
          <h2 className="text-display-md font-medium leading-[1.05] tracking-[-0.025em] max-w-[520px] mx-auto">
            From uncontrolled to protected in 10 minutes.
          </h2>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center mb-12 max-w-[560px] mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-body-sm font-semibold"
                  style={{
                    background: step >= s.id ? "#F4533C" : "rgba(255,255,255,0.06)",
                    color: step >= s.id ? "#fff" : "rgba(255,255,255,0.25)",
                    boxShadow: step === s.id
                      ? "0 0 0 4px rgba(244,83,60,0.15), 0 0 20px rgba(244,83,60,0.25)"
                      : "none",
                    transition: "background 0.4s, color 0.4s, box-shadow 0.4s",
                  }}
                >
                  {s.id}
                </div>
                <span
                  className="text-mono-sm whitespace-nowrap"
                  style={{
                    color: step >= s.id ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
                    transition: "color 0.4s",
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="h-px mb-7 mx-1"
                  style={{
                    width: 48,
                    background: step > s.id
                      ? "#F4533C"
                      : "rgba(255,255,255,0.07)",
                    transition: "background 0.5s",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Panel */}
        <div
          className="mx-auto max-w-[660px]"
          style={{
            opacity: loopVisible ? 1 : 0,
            transition: "opacity 0.5s",
          }}
        >
          <div
            className="relative rounded-tg-xl border border-border-default bg-surface-1 p-7 overflow-hidden"
            style={{
              boxShadow: "0 24px 70px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
              minHeight: 340,
            }}
          >
            {/* top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(244,83,60,0.45), transparent)" }}
            />

            <div
              style={{
                opacity: panelVisible ? 1 : 0,
                transform: panelVisible ? "translateY(0)" : "translateY(5px)",
                transition: `opacity ${FADE}ms ease, transform ${FADE}ms ease`,
              }}
            >
              {step === 1 && <Step1Panel phase={phase} />}
              {step === 2 && <Step2Panel phase={phase} />}
              {step === 3 && <Step3Panel phase={phase} />}
              {step === 4 && <Step4Panel phase={phase} />}
            </div>
          </div>

          {/* caption */}
          <p
            key={step}
            className="text-center text-body-sm text-tertiary mt-5"
            style={{ animation: "tg-fadein-up 0.4s ease" }}
          >
            {CAPTIONS[step]}
          </p>
        </div>

      </div>
    </section>
  );
}
