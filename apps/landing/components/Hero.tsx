import { ArrowRight } from "lucide-react";
import { ChaosPanel } from "./ChaosPanel";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";
const DOCS_URL      = process.env.NEXT_PUBLIC_DOCS_URL      ?? "http://localhost:3002";

export function Hero() {
  return (
    <section className="hero-glow min-h-[calc(100vh-60px)] flex items-center py-20">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8 w-full">
        <div className="grid md:grid-cols-2 gap-14 md:gap-10 items-center">

          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-tg-full border border-accent-border bg-accent-bg px-3 py-1 mb-7">
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent"
                style={{ animation: "tg-pulse 1.4s ease-in-out infinite" }}
              />
              <span className="text-micro uppercase text-accent tracking-[0.04em]">
                For customer support agents
              </span>
            </div>

            <h1 className="text-display-xl font-medium leading-[1.02] tracking-[-0.03em] mb-6">
              Your support agent
              <br />
              <span className="text-accent italic">doesn&apos;t know</span>
              <br />
              when to stop.
            </h1>

            <p className="text-body-lg text-secondary max-w-[440px] mb-9 leading-[1.65]">
              It will refund every order. Cancel every subscription. Delete every account.
              Because nobody told it not to.
              <br /><br />
              Tollgate gives it rules.
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              <a
                href={`${DASHBOARD_URL}/signup`}
                className="inline-flex items-center gap-2 bg-accent text-primary px-5 py-[11px] rounded-tg-md text-body-lg font-medium hover:opacity-90 transition-opacity"
              >
                Start for free
                <ArrowRight size={15} strokeWidth={2} />
              </a>
              <a
                href={`${DOCS_URL}/docs/guides/customer-support-agent`}
                className="text-body-lg text-secondary hover:text-primary transition-colors"
              >
                See the 15-min guide →
              </a>
            </div>
          </div>

          {/* Right: live chaos panel */}
          <ChaosPanel />
        </div>
      </div>
    </section>
  );
}
