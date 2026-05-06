import { Headset, CreditCard, Code2, Building2 } from "lucide-react";

const CASES = [
  {
    icon: Headset,
    title: "Customer support agents",
    description:
      "Let agents handle tier-1 tickets autonomously — password resets, status checks, small refunds. Escalate anything that touches money or account standing.",
    examples: ["Issue refunds under $50", "Reset passwords", "Update shipping address"],
    blocked: "Cancel subscriptions, large credits",
  },
  {
    icon: CreditCard,
    title: "Finance automation",
    description:
      "Automate AP/AR workflows with guardrails. Agents process invoices, flag anomalies, and route large transactions for human sign-off.",
    examples: ["Process invoices under $10k", "Flag duplicate vendors", "Auto-reconcile"],
    blocked: "Wire transfers, new vendor creation",
  },
  {
    icon: Code2,
    title: "DevOps & infra agents",
    description:
      "Give agents read access everywhere and write access where it's safe. Production deployments and config changes still require a human in the loop.",
    examples: ["Scale read replicas", "Rotate non-prod secrets", "Restart services"],
    blocked: "Production deploys, DB migrations",
  },
  {
    icon: Building2,
    title: "Sales & CRM agents",
    description:
      "Agents can enrich leads, draft emails, and update CRM fields. Approvals kick in before sending external-facing messages or changing deal stage.",
    examples: ["Enrich lead data", "Draft outreach", "Log call notes"],
    blocked: "Send emails, update pipeline stage",
  },
];

export function UseCases() {
  return (
    <section className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">
        {/* Section header */}
        <div className="mb-14">
          <p className="text-micro uppercase text-tertiary tracking-[0.04em] mb-3">
            Use cases
          </p>
          <h2 className="text-display-md font-medium leading-[1.05] tracking-[-0.025em] max-w-[560px]">
            Every team deploying agents needs this.
          </h2>
        </div>

        {/* 2×2 grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {CASES.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="rounded-tg-xl border border-border-default bg-surface-1 p-7 flex flex-col gap-5"
              >
                {/* Icon stacked above title */}
                <div>
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-tg-md bg-accent-bg border border-accent-border">
                    <Icon size={18} className="text-accent" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-heading-lg font-medium mt-3">{c.title}</h3>
                </div>

                {/* Description */}
                <p className="text-body-md text-secondary leading-[1.65]">
                  {c.description}
                </p>

                {/* Allowed list — no label, just bullets with border separator */}
                <div className="pt-4 border-t border-border-subtle">
                  <ul className="flex flex-col gap-2.5">
                    {c.examples.map((ex) => (
                      <li key={ex} className="flex items-center gap-2.5 text-body-sm text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Blocked */}
                <div className="flex items-start gap-2 rounded-tg-md bg-accent-bg border border-accent-border px-3 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-[5px]" />
                  <p className="text-body-sm text-secondary">
                    <span className="text-accent font-medium">Requires approval:</span>{" "}
                    {c.blocked}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
