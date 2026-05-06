import { ArrowRight, Check } from "lucide-react";

const STATS = [
  { value: "< 50ms", label: "median check latency" },
  { value: "100%", label: "audit coverage" },
  { value: "0 code", label: "changes to agents" },
];

function DemoPanel() {
  return (
    <div className="relative w-full max-w-[500px] ml-auto">
      <div
        className="rounded-tg-xl border border-border-default bg-surface-1 overflow-hidden"
        style={{
          boxShadow:
            "0 40px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <span className="w-3 h-3 rounded-full bg-border-strong" />
          <span className="w-3 h-3 rounded-full bg-border-strong" />
          <span className="w-3 h-3 rounded-full bg-border-strong" />
          <span className="ml-2 text-mono-sm text-tertiary">agent activity</span>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {/* Element 1: auto-approved card */}
          <div
            className="rounded-tg-lg border border-success-border bg-success-bg px-4 py-3"
            style={{
              opacity: 0,
              animation:
                "tg-reveal 24s cubic-bezier(0.2,0.8,0.2,1) 0s infinite backwards",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-mono-sm text-tertiary">issue_refund</p>
                <p className="text-body-sm text-primary font-medium mt-0.5">
                  $30 · customer c_001
                </p>
              </div>
              <span className="flex items-center gap-1 text-success text-mono-sm">
                <Check size={12} strokeWidth={2.5} />
                allowed
              </span>
            </div>
          </div>

          {/* Element 2: separator */}
          <div
            className="h-px bg-border-subtle"
            style={{
              opacity: 0,
              animation:
                "tg-reveal 24s cubic-bezier(0.2,0.8,0.2,1) 1.2s infinite backwards",
            }}
          />

          {/* Element 3: pending card */}
          <div
            className="rounded-tg-lg border border-accent-border bg-accent-bg px-4 py-3"
            style={{
              opacity: 0,
              animation:
                "tg-reveal 24s cubic-bezier(0.2,0.8,0.2,1) 2.4s infinite backwards",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-mono-sm text-tertiary">issue_refund</p>
                <p className="text-body-sm text-primary font-medium mt-0.5">
                  $1,200 · customer c_002
                </p>
                <p className="text-body-sm text-secondary mt-1">
                  Exceeds auto-approve threshold
                </p>
              </div>
              <span className="mt-1 flex items-center gap-1.5 shrink-0">
                <span
                  className="w-2 h-2 rounded-full bg-accent"
                  style={{ animation: "tg-pulse 1.4s ease-in-out infinite" }}
                />
                <span className="text-mono-sm text-accent">pending</span>
              </span>
            </div>
          </div>

          {/* Element 4: Slack notification */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-tg-lg border border-border-subtle bg-surface-2"
            style={{
              opacity: 0,
              animation:
                "tg-reveal 24s cubic-bezier(0.2,0.8,0.2,1) 3.6s infinite backwards",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.6 2.4a2.4 2.4 0 1 0 0 4.8H12V2.4H9.6z" fill="#E01E5A" />
              <path d="M14.4 2.4a2.4 2.4 0 1 1 0 4.8H12V2.4h2.4z" fill="#36C5F0" />
              <path d="M2.4 9.6a2.4 2.4 0 1 0 4.8 0V7.2H2.4v2.4z" fill="#2EB67D" />
              <path d="M2.4 14.4a2.4 2.4 0 1 1 4.8 0V12H2.4v2.4z" fill="#ECB22E" />
              <path d="M9.6 21.6a2.4 2.4 0 1 0 0-4.8H7.2v4.8H9.6z" fill="#ECB22E" />
              <path d="M14.4 21.6a2.4 2.4 0 1 1 0-4.8H12v4.8h2.4z" fill="#2EB67D" />
              <path d="M21.6 9.6a2.4 2.4 0 1 1-4.8 0V7.2h4.8V9.6z" fill="#36C5F0" />
              <path d="M21.6 14.4a2.4 2.4 0 1 0-4.8 0V12h4.8v2.4z" fill="#E01E5A" />
            </svg>
            <p className="text-body-sm text-secondary flex-1">
              Approval request sent to{" "}
              <span className="text-primary">#approvals</span>
            </p>
          </div>

          {/* Element 5: Approve / Reject */}
          <div
            className="flex gap-2"
            style={{
              opacity: 0,
              animation:
                "tg-reveal 24s cubic-bezier(0.2,0.8,0.2,1) 4.8s infinite backwards",
            }}
          >
            <button
              className="flex-1 py-2.5 rounded-tg-md text-body-sm font-medium text-white"
              style={{
                background: "#1f7a3f",
                animation:
                  "tg-press 24s cubic-bezier(0.2,0.8,0.2,1) 3.6s infinite backwards",
              }}
            >
              Approve
            </button>
            <button className="flex-1 py-2.5 rounded-tg-md text-body-sm font-medium text-secondary border border-border-default bg-transparent">
              Reject
            </button>
          </div>

          {/* Cursor blink */}
          <div className="flex items-center gap-1.5">
            <span className="text-mono-sm text-tertiary">›</span>
            <span
              className="inline-block w-[7px] h-[14px] bg-accent-soft rounded-sm"
              style={{ animation: "tg-blink 1.1s step-end infinite" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero-glow pt-20 pb-20 md:pt-28 md:pb-28">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-8 items-center">
          {/* Left column */}
          <div>
            {/* Status pill */}
            <div className="inline-flex items-center gap-2 rounded-tg-full border border-accent-border bg-accent-bg px-3 py-1 mb-7">
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent"
                style={{ animation: "tg-pulse 1.4s ease-in-out infinite" }}
              />
              <span className="text-micro uppercase text-accent tracking-[0.04em]">
                Now in beta
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-display-xl font-medium leading-[1.02] tracking-[-0.03em] mb-6">
              Bounded autonomy
              <br />
              <span className="text-accent italic">for AI agents.</span>
            </h1>

            {/* Subhead */}
            <p className="text-body-lg text-secondary max-w-[460px] mb-9 leading-[1.65]">
              Define what your agents can do. Approve what&apos;s risky. Audit
              everything. Tollgate is the policy and approval layer between your
              agents and the real world.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-4 mb-12 flex-wrap">
              <a
                href="/signup"
                className="inline-flex items-center gap-2 bg-accent text-primary px-5 py-[11px] rounded-tg-md text-body-lg font-medium hover:opacity-90 transition-opacity"
              >
                Start for free
                <ArrowRight size={15} strokeWidth={2} />
              </a>
              <a
                href="/docs"
                className="inline-flex items-center gap-2 text-body-lg text-secondary hover:text-primary transition-colors"
              >
                Read the docs
              </a>
            </div>

            {/* Stat strip */}
            <div className="flex items-start flex-wrap gap-y-4">
              {STATS.map(({ value, label }, i) => (
                <div
                  key={i}
                  className={`flex flex-col pr-8 ${i > 0 ? "border-l border-border-subtle pl-8" : ""}`}
                >
                  <span className="text-display-md font-medium tracking-[-0.025em] text-primary leading-none">
                    {value}
                  </span>
                  <span className="text-body-sm text-tertiary mt-1">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: animated demo */}
          <DemoPanel />
        </div>
      </div>
    </section>
  );
}
