import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-28 border-t border-border-subtle">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(244,83,60,0.07) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-[1140px] px-6 md:px-8 text-center">
        <p className="text-micro uppercase text-tertiary tracking-[0.04em] mb-6">
          Get started today
        </p>
        <h2 className="text-display-xl font-medium leading-[1.02] tracking-[-0.03em] mb-6 max-w-[640px] mx-auto">
          Deploy your agents.{" "}
          <span className="text-accent italic">Safely.</span>
        </h2>
        <p className="text-body-lg text-secondary max-w-[440px] mx-auto mb-10">
          Start free. No credit card required. Takes 10 minutes to wrap your
          first agent action.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="/signup"
            className="inline-flex items-center gap-2 bg-accent text-primary px-7 py-[13px] rounded-tg-md text-body-lg font-medium hover:opacity-90 transition-opacity"
          >
            Start for free
            <ArrowRight size={15} strokeWidth={2} />
          </a>
          <a
            href="/docs"
            className="inline-flex items-center gap-2 text-body-lg text-secondary hover:text-primary transition-colors px-7 py-[13px]"
          >
            Read the docs
          </a>
        </div>
      </div>
    </section>
  );
}
