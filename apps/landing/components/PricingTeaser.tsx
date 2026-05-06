import { CircleCheck } from "lucide-react";

const PLANS = [
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    note: "per workspace · cancel anytime",
    description: null,
    cta: { label: "Start free trial", href: "/signup" },
    ctaStyle: "primary" as const,
    featured: true,
    features: [
      "Up to 10 agents",
      "10,000 checks / month",
      "Slack approvals",
      "Policy-as-code (YAML)",
      "Full audit log",
      "7-day retention",
    ],
  },
  {
    name: "Enterprise",
    price: null,
    period: null,
    note: null,
    description: "Custom pricing for high-volume, compliance, and self-hosted teams.",
    cta: { label: "Talk to us", href: "mailto:hello@usetollgate.com" },
    ctaStyle: "ghost" as const,
    featured: false,
    features: [
      "Everything in Pro",
      "Unlimited agents & checks",
      "Custom approval workflows",
      "SSO / SAML",
      "90-day retention",
      "SLA + dedicated support",
      "Custom integrations",
    ],
  },
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="py-28 border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">
        {/* Section header — centered */}
        <div className="text-center mb-16">
          <h2 className="text-display-md font-medium leading-[1.05] tracking-[-0.025em]">
            Simple, predictable pricing.
          </h2>
          <p className="text-body-lg text-secondary mt-4">
            Start free. Pay when you scale. No per-seat nonsense.
          </p>
        </div>

        {/* Two-card layout — centered */}
        <div className="grid md:grid-cols-2 gap-5 max-w-[820px] mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-tg-xl border flex flex-col overflow-hidden ${
                plan.featured
                  ? "border-accent-border bg-surface-2"
                  : "border-border-default bg-surface-1"
              }`}
            >
              {/* Accent top bar for featured plan */}
              {plan.featured && (
                <div className="absolute top-0 inset-x-0 h-[2px] bg-accent rounded-t-tg-xl" />
              )}

              {/* Top section: name, price, CTA — centered */}
              <div className="px-8 pt-8 pb-7 text-center flex flex-col gap-5">
                <p className="text-heading-md font-medium text-primary">{plan.name}</p>

                {plan.price ? (
                  <div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-display-lg font-medium leading-none tracking-[-0.025em]">
                        {plan.price}
                      </span>
                      <span className="text-body-lg text-secondary">{plan.period}</span>
                    </div>
                    {plan.note && (
                      <p className="text-body-sm text-tertiary mt-2">{plan.note}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-body-md text-secondary leading-[1.65] max-w-[260px] mx-auto">
                    {plan.description}
                  </p>
                )}

                {/* Full-width CTA */}
                <a
                  href={plan.cta.href}
                  className={`block w-full text-center py-3 rounded-tg-md text-body-md font-medium transition-opacity ${
                    plan.ctaStyle === "primary"
                      ? "bg-accent text-primary hover:opacity-90"
                      : "bg-surface-2 border border-border-strong text-secondary hover:text-primary hover:border-primary transition-colors"
                  }`}
                >
                  {plan.cta.label}
                </a>
              </div>

              {/* Separator */}
              <div className="border-t border-border-subtle" />

              {/* Feature list */}
              <div className="px-8 py-7">
                <ul className="flex flex-col gap-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-body-md text-secondary">
                      <CircleCheck
                        size={17}
                        className="text-accent shrink-0 mt-[1px]"
                        strokeWidth={1.75}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
