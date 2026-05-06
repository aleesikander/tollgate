import { AnimatedSlackApproval } from "./AnimatedSlackApproval";

const STEPS = [
  {
    number: "01",
    title: "Define your policy",
    description:
      "Write a YAML policy that specifies which actions are allowed, which need approval, and which are always blocked. Version-controlled, auditable.",
    lang: "yaml",
    code: `rules:
  - action: issue_refund
    conditions:
      - field: amount
        op: lte
        value: 50
    decision: allow

  - action: issue_refund
    conditions:
      - field: amount
        op: lte
        value: 500
    decision: pending
    notify:
      slack: "#approvals"`,
    tokens: [
      { text: "rules", color: "text-accent-soft" },
      { text: "action", color: "text-accent-soft" },
      { text: "conditions", color: "text-accent-soft" },
      { text: "field", color: "text-accent-soft" },
      { text: "op", color: "text-accent-soft" },
      { text: "value", color: "text-accent-soft" },
      { text: "decision", color: "text-accent-soft" },
      { text: "notify", color: "text-accent-soft" },
      { text: "slack", color: "text-accent-soft" },
    ],
  },
  {
    number: "02",
    title: "Wrap agent actions",
    description:
      "Add a single decorator to your agent functions. Zero changes to agent logic — Tollgate intercepts before execution.",
    lang: "python",
    code: `import tollgate as tg

client = tg.Tollgate(
  api_key=os.environ["TG_KEY"]
)

@client.guard("issue_refund")
def issue_refund(amount, customer_id):
    # only runs if policy allows
    stripe.refund(amount, customer_id)`,
  },
  {
    number: "03",
    title: "Approve in Slack",
    description:
      "High-risk actions pause and notify your team in Slack. One click to approve or reject — with full context and audit trail.",
    lang: "slack",
    code: `🔔 Approval required

  Action    issue_refund
  Amount    $1,200.00
  Customer  c_002 · acme-corp

  Policy: exceeds auto-approve limit ($500)
  Agent:  support-bot · production

  [ Approve ]   [ Reject ]`,
  },
];

function CodeBlock({ step }: { step: (typeof STEPS)[0] }) {
  if (step.lang === "slack") {
    const lines = step.code.split("\n");
    return (
      <div className="rounded-tg-lg bg-surface-2 border border-border-default p-4 font-mono text-mono-md leading-relaxed overflow-x-auto">
        {lines.map((line, i) => {
          if (line.includes("🔔")) {
            return (
              <p key={i} className="text-primary mb-2">
                {line}
              </p>
            );
          }
          if (line.includes("[ Approve ]")) {
            return (
              <p key={i} className="mt-3">
                <span className="inline-block px-3 py-1 rounded bg-slack-green text-white text-mono-sm mr-2">
                  Approve
                </span>
                <span className="inline-block px-3 py-1 rounded border border-border-default text-secondary text-mono-sm">
                  Reject
                </span>
              </p>
            );
          }
          const colonIdx = line.indexOf("  ", 2);
          if (colonIdx > 0 && line.trim().includes("  ") && !line.startsWith("  [") && line.trim() !== "") {
            const parts = line.split(/\s{2,}/);
            if (parts.length >= 2 && !parts[0].includes("·") && parts[0].trim() !== "") {
              return (
                <p key={i} className="flex gap-2">
                  <span className="text-tertiary w-20 shrink-0">{parts[0]}</span>
                  <span className="text-secondary">{parts.slice(1).join("  ")}</span>
                </p>
              );
            }
          }
          return (
            <p key={i} className="text-secondary">
              {line || " "}
            </p>
          );
        })}
      </div>
    );
  }

  if (step.lang === "yaml") {
    return (
      <div className="rounded-tg-lg bg-surface-2 border border-border-default p-4 font-mono text-mono-md leading-relaxed overflow-x-auto">
        {step.code.split("\n").map((line, i) => {
          const indent = line.match(/^(\s*)/)?.[1] ?? "";
          const content = line.trimStart();
          if (!content) return <p key={i}>&nbsp;</p>;

          if (content.startsWith("- ")) {
            const rest = content.slice(2);
            const colonIdx = rest.indexOf(":");
            if (colonIdx !== -1) {
              const key = rest.slice(0, colonIdx);
              const val = rest.slice(colonIdx + 1);
              return (
                <p key={i}>
                  <span className="text-tertiary">{indent}- </span>
                  <span className="text-accent-soft">{key}</span>
                  <span className="text-border-strong">:</span>
                  <span className="text-secondary">{val}</span>
                </p>
              );
            }
            return (
              <p key={i}>
                <span className="text-tertiary">{indent}- </span>
                <span className="text-secondary">{rest}</span>
              </p>
            );
          }

          const colonIdx = content.indexOf(":");
          if (colonIdx !== -1) {
            const key = content.slice(0, colonIdx);
            const val = content.slice(colonIdx + 1);
            return (
              <p key={i}>
                <span className="text-tertiary">{indent}</span>
                <span className="text-accent-soft">{key}</span>
                <span className="text-border-strong">:</span>
                <span className="text-secondary">{val}</span>
              </p>
            );
          }

          return (
            <p key={i}>
              <span className="text-tertiary">{indent}</span>
              <span className="text-secondary">{content}</span>
            </p>
          );
        })}
      </div>
    );
  }

  // Python
  return (
    <div className="rounded-tg-lg bg-surface-2 border border-border-default p-4 font-mono text-mono-md leading-relaxed overflow-x-auto">
      {step.code.split("\n").map((line, i) => {
        if (!line.trim()) return <p key={i}>&nbsp;</p>;

        // comment
        if (line.trimStart().startsWith("#")) {
          return (
            <p key={i}>
              <span className="text-tertiary">{line}</span>
            </p>
          );
        }

        // import/decorator
        if (line.startsWith("import ") || line.startsWith("@")) {
          const atIdx = line.indexOf("@");
          if (atIdx === 0) {
            return (
              <p key={i}>
                <span className="text-accent">@</span>
                <span className="text-secondary">{line.slice(1)}</span>
              </p>
            );
          }
          const [kw, ...rest] = line.split(" ");
          return (
            <p key={i}>
              <span className="text-accent-soft">{kw}</span>
              <span className="text-secondary"> {rest.join(" ")}</span>
            </p>
          );
        }

        // def
        if (line.trimStart().startsWith("def ")) {
          const indent = line.match(/^(\s*)/)?.[1] ?? "";
          const rest = line.trimStart().slice(4);
          const parenIdx = rest.indexOf("(");
          const name = parenIdx !== -1 ? rest.slice(0, parenIdx) : rest;
          const args = parenIdx !== -1 ? rest.slice(parenIdx) : "";
          return (
            <p key={i}>
              <span className="text-tertiary">{indent}</span>
              <span className="text-accent-soft">def </span>
              <span className="text-primary">{name}</span>
              <span className="text-secondary">{args}</span>
            </p>
          );
        }

        // string in value (simple key=value)
        const strMatch = line.match(/^(\s*\w+\s*=\s*)(os\.environ\["[^"]+"\]|"[^"]*")(.*)$/);
        if (strMatch) {
          return (
            <p key={i}>
              <span className="text-secondary">{strMatch[1]}</span>
              <span className="text-success">{strMatch[2]}</span>
              <span className="text-secondary">{strMatch[3]}</span>
            </p>
          );
        }

        return (
          <p key={i}>
            <span className="text-secondary">{line}</span>
          </p>
        );
      })}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">
        {/* Section header — centered */}
        <div className="text-center mb-16">
          <p className="text-micro uppercase text-tertiary tracking-[0.04em] mb-3">
            How it works
          </p>
          <h2 className="text-display-md font-medium leading-[1.05] tracking-[-0.025em] max-w-[480px] mx-auto">
            From risky to safe in three steps.
          </h2>
        </div>

        {/* Step cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="flex flex-col gap-5 rounded-tg-xl border border-border-default bg-surface-1 p-7"
            >
              {/* Large decorative step number */}
              <div>
                <span className="text-[42px] font-medium text-border-strong leading-none">
                  {step.number}
                </span>
                <h3 className="text-heading-lg font-medium mt-2">{step.title}</h3>
              </div>
              <p className="text-body-md text-secondary leading-[1.65]">
                {step.description}
              </p>
              {step.lang === "slack" ? <AnimatedSlackApproval /> : <CodeBlock step={step} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
