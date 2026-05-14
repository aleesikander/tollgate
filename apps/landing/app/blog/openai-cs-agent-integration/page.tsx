import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

function CodeBlock({ children, lang }: { children: string; lang: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] overflow-hidden my-6">
      <div
        className="px-4 py-2 border-b border-white/[0.06] text-micro uppercase tracking-[0.06em]"
        style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)" }}
      >
        {lang}
      </div>
      <pre
        className="overflow-x-auto p-5 text-sm leading-relaxed"
        style={{ background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.75)", fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace" }}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SlackPreview() {
  return (
    <div
      className="rounded-lg border border-white/10 my-6 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-body-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
          # approvals
        </p>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-sm"
            style={{ background: "rgba(244,83,60,0.15)", color: "#F4533C" }}
          >
            T
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                Tollgate
              </span>
              <span className="text-micro" style={{ color: "rgba(255,255,255,0.3)" }}>
                Today at 2:41 PM
              </span>
            </div>
            <div
              className="rounded-md border-l-4 p-4 mt-1"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "#F4533C" }}
            >
              <p
                className="font-semibold mb-3"
                style={{ fontSize: 15, color: "rgba(255,255,255,0.9)" }}
              >
                🔔 Approval Required
              </p>
              <div className="flex flex-col gap-1.5 mb-4">
                {[
                  ["Agent", "airline-demo-agent"],
                  ["Action", "cancel_flight"],
                  ["Payload", '{"flight_number": "PA441", "passenger_name": "Morgan Lee", "confirmation_number": "IR-D204"}'],
                  ["Rule", "matched rule for cancel_flight"],
                ].map(([key, val]) => (
                  <div key={key} className="flex gap-2 text-body-sm flex-wrap">
                    <span style={{ color: "rgba(255,255,255,0.4)", minWidth: 60 }}>{key}</span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontFamily: key === "Payload" ? "ui-monospace, monospace" : undefined,
                        fontSize: key === "Payload" ? 12 : undefined,
                      }}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <span
                  className="px-3 py-1.5 rounded text-body-sm font-medium"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                >
                  ✅ Approve
                </span>
                <span
                  className="px-3 py-1.5 rounded text-body-sm font-medium"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  ❌ Reject
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const BASH_CLONE = `git clone https://github.com/openai/openai-cs-agents-demo
cd openai-cs-agents-demo/python-backend
pip install -r requirements.txt`;

const PYTHON_GUARD = `import asyncio
import httpx
import os

TOLLGATE_BASE_URL = os.environ.get("TOLLGATE_BASE_URL", "https://toll-gate-production.up.railway.app")
TOLLGATE_API_KEY = os.environ.get("TOLLGATE_API_KEY", "")

async def tollgate_guard(action: str, payload: dict) -> str:
    """
    Submit an action to tollgate for policy evaluation.
    Returns 'allowed' if approved, 'denied' if rejected.
    Blocks and polls if the decision is pending (requires human approval).
    Times out after 5 minutes and defaults to deny.
    """
    import uuid
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{TOLLGATE_BASE_URL}/v1/check",
            json={
                "action_name": action,
                "idempotency_key": str(uuid.uuid4()),
                "payload": payload,
            },
            headers={"Authorization": f"Bearer {TOLLGATE_API_KEY}"},
            timeout=10.0,
        )
        resp.raise_for_status()
        result = resp.json()
        decision = result["decision"]
        if decision in ("allowed", "denied"):
            return decision
        action_id = result["action_id"]
        for _ in range(150):  # poll up to 5 minutes
            await asyncio.sleep(2)
            poll = await client.get(
                f"{TOLLGATE_BASE_URL}/v1/check/{action_id}",
                headers={"Authorization": f"Bearer {TOLLGATE_API_KEY}"},
                timeout=10.0,
            )
            poll.raise_for_status()
            status = poll.json()["decision"]
            if status in ("allowed", "approved"):
                return "allowed"
            if status in ("denied", "rejected"):
                return "denied"
        return "denied"  # timeout = deny for safety`;

const PYTHON_CANCEL = `@function_tool(
    name_override="cancel_flight",
    description_override="Cancel a flight."
)
async def cancel_flight(
    context: RunContextWrapper[AirlineAgentChatContext]
) -> str:
    """Cancel the flight in the context."""
    apply_itinerary_defaults(context.context.state)
    fn = context.context.state.flight_number
    assert fn is not None, "Flight number is required"
    confirmation = context.context.state.confirmation_number or "".join(
        random.choices(string.ascii_uppercase + string.digits, k=6)
    )
    context.context.state.confirmation_number = confirmation

    # tollgate policy check — intercepts before execution
    decision = await tollgate_guard(
        action="cancel_flight",
        payload={
            "flight_number": fn,
            "confirmation_number": confirmation,
            "passenger_name": getattr(context.context.state, "passenger_name", None),
        }
    )

    if decision != "allowed":
        return f"Cancellation of flight {fn} requires human approval or was denied."

    return f"Flight {fn} successfully cancelled for confirmation {confirmation}"`;

const YAML_POLICY = `version: 1
rules:
  - action: cancel_flight
    decide: require_approval
    approvers: ["#approvals"]
default: allow`;

const BASH_RUN = `export OPENAI_API_KEY=your-openai-key
export TOLLGATE_API_KEY=tg_live_your-key
python3 -m uvicorn main:app --port 8001`;

const proseText: React.CSSProperties = { color: "rgba(255,255,255,0.62)", lineHeight: 1.85 };
const proseHeading: React.CSSProperties = { color: "rgba(255,255,255,0.88)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", marginTop: "2.25rem", marginBottom: "0.75rem" };

export default function BlogPost() {
  return (
    <>
      <Nav />
      <main className="pt-[60px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-8 py-14 md:py-20">
          <a
            href="/blog"
            className="inline-flex items-center gap-1.5 text-body-sm text-tertiary hover:text-primary transition-colors mb-12"
          >
            ← Blog
          </a>

          <div className="max-w-[680px]">
            {/* Header */}
            <div className="mb-10">
              <h1
                className="font-semibold leading-[1.1] tracking-[-0.025em] mb-4"
                style={{ fontSize: 32, color: "rgba(255,255,255,0.92)" }}
              >
                How we added human-in-the-loop approval to OpenAI&apos;s customer
                service agent
              </h1>
              <p className="text-body-sm text-tertiary">
                May 14, 2026 &middot; 5 min read
              </p>
            </div>

            <div className="h-px border-t border-border-subtle mb-10" />

            {/* The problem */}
            <h2 style={proseHeading}>The problem</h2>
            <p className="text-body-md mb-4" style={proseText}>
              OpenAI recently open-sourced a customer service agent demo built on
              their Agents SDK. It&apos;s a multi-agent system: a Triage Agent routes
              requests to specialist sub-agents — one for bookings and
              cancellations, one for seat changes, one for refunds, one for FAQs.
            </p>
            <p className="text-body-md mb-4" style={proseText}>
              It works beautifully. A customer types &ldquo;I need to cancel my
              flight.&rdquo; The Triage Agent hands off to the Booking and
              Cancellation Agent. The agent confirms the details and calls{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                cancel_flight
              </code>
              . Flight cancelled. Two seconds, zero human involvement.
            </p>
            <p className="text-body-md mb-4 font-medium" style={{ ...proseText, color: "rgba(255,255,255,0.82)" }}>
              That&apos;s the problem.
            </p>
            <p className="text-body-md mb-4" style={proseText}>
              There&apos;s nothing between the agent&apos;s decision and the action. No
              policy layer. No approval gate. No audit trail. For a demo,
              that&apos;s fine. For production — where real customers, real money,
              and real consequences are involved — it&apos;s not.
            </p>
            <p className="text-body-md mb-8" style={proseText}>
              This is what we built tollgate to solve.
            </p>

            {/* What we're integrating */}
            <h2 style={proseHeading}>What we&apos;re integrating</h2>
            <p className="text-body-md mb-4" style={proseText}>
              The OpenAI CS agents demo is at{" "}
              <a
                href="https://github.com/openai/openai-cs-agents-demo"
                className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: "rgba(255,255,255,0.75)" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/openai/openai-cs-agents-demo
              </a>
              . Python backend, Next.js frontend, runs locally in two terminal
              tabs. The agents handle cancellations, seat changes, flight status,
              and FAQs for a fictional airline.
            </p>
            <p className="text-body-md mb-8" style={proseText}>
              Our goal: intercept the{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                cancel_flight
              </code>{" "}
              action before it executes, route it to a human for approval in
              Slack, and only proceed once someone clicks Approve. Zero changes to
              the agent&apos;s logic.
            </p>

            {/* Step 1 */}
            <h2 style={proseHeading}>Step 1 — Clone the demo and install tollgate</h2>
            <CodeBlock lang="bash">{BASH_CLONE}</CodeBlock>
            <p className="text-body-md mb-8" style={proseText}>
              You&apos;ll also need your tollgate API key. Sign up at{" "}
              <a
                href="https://usetollgate.com"
                className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                usetollgate.com
              </a>
              , create an agent, and copy the key — it looks like{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                tg_live_...
              </code>
              .
            </p>

            {/* Step 2 */}
            <h2 style={proseHeading}>Step 2 — Add the tollgate guard function</h2>
            <p className="text-body-md mb-2" style={proseText}>
              Open{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                python-backend/airline/tools.py
              </code>{" "}
              and add this helper function:
            </p>
            <CodeBlock lang="python">{PYTHON_GUARD}</CodeBlock>

            {/* Step 3 */}
            <h2 style={proseHeading}>Step 3 — Wrap the cancel_flight action</h2>
            <p className="text-body-md mb-2" style={proseText}>
              Find the{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                cancel_flight
              </code>{" "}
              function in the same file and add the tollgate check before the
              return statement:
            </p>
            <CodeBlock lang="python">{PYTHON_CANCEL}</CodeBlock>
            <p className="text-body-md mb-8" style={proseText}>
              That&apos;s the entire integration. The agent code is otherwise
              untouched.
            </p>

            {/* Step 4 */}
            <h2 style={proseHeading}>Step 4 — Define the policy</h2>
            <p className="text-body-md mb-2" style={proseText}>
              In your tollgate dashboard, navigate to your agent and open the
              Policy tab. Add this rule:
            </p>
            <CodeBlock lang="yaml">{YAML_POLICY}</CodeBlock>
            <p className="text-body-md mb-8" style={proseText}>
              This tells tollgate: whenever{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                cancel_flight
              </code>{" "}
              is called, pause execution and route to the{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                #approvals
              </code>{" "}
              Slack channel for human sign-off. Everything else auto-allows.
            </p>

            {/* Step 5 */}
            <h2 style={proseHeading}>Step 5 — Connect Slack and run</h2>
            <p className="text-body-md mb-2" style={proseText}>
              In tollgate dashboard Settings, connect your Slack workspace. Then
              start the backend with your keys:
            </p>
            <CodeBlock lang="bash">{BASH_RUN}</CodeBlock>
            <p className="text-body-md mb-4" style={proseText}>
              Now try it. Type &ldquo;I need to cancel my flight&rdquo; in the demo UI.
              The agent processes the request, verifies the booking — and then
              pauses. A message appears in your Slack{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                #approvals
              </code>{" "}
              channel:
            </p>
            <SlackPreview />
            <p className="text-body-md mb-4" style={proseText}>
              Click Approve. The agent receives the decision, and the cancellation
              completes. The customer sees: &ldquo;Your flight PA441 has been
              successfully cancelled.&rdquo;
            </p>
            <p className="text-body-md mb-8" style={proseText}>
              Click Reject. The agent tells the customer the cancellation
              couldn&apos;t be processed and suggests contacting support.
            </p>

            {/* What just happened */}
            <h2 style={proseHeading}>What just happened</h2>
            <p className="text-body-md mb-4" style={proseText}>
              The agent called{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                cancel_flight
              </code>
              . Tollgate intercepted it before execution, evaluated the policy,
              found a matching rule, and held the action pending human approval.
              The agent&apos;s execution was paused — blocking on the{" "}
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", fontFamily: "ui-monospace, monospace" }}
              >
                tollgate_guard
              </code>{" "}
              poll — until a human made a decision in Slack. Then execution
              resumed.
            </p>
            <p className="text-body-md mb-8" style={proseText}>
              The agent never knew about Slack. The agent never knew about the
              policy. The agent just called a function and got back a result.
              Everything else happened in the tollgate layer.
            </p>

            {/* The pattern */}
            <h2 style={proseHeading}>The pattern</h2>
            <p
              className="text-body-md mb-4 font-medium"
              style={{ ...proseText, color: "rgba(255,255,255,0.82)" }}
            >
              One function. One policy file. Zero changes to agent logic.
            </p>
            <p className="text-body-md mb-4" style={proseText}>
              This is the tollgate integration pattern. It works the same way for
              any agent action — refunds, account deletions, deployments, wire
              transfers. Wrap the function, define the policy, connect your
              approval channel.
            </p>
            <p
              className="text-body-md mb-8 font-medium"
              style={{ ...proseText, color: "rgba(255,255,255,0.82)" }}
            >
              Your agents can act. Safely.
            </p>

            {/* Get started */}
            <div className="h-px border-t border-border-subtle mb-8" />
            <h2 style={{ ...proseHeading, marginTop: 0 }}>Get started</h2>
            <p className="text-body-md mb-4" style={proseText}>
              Sign up free at{" "}
              <a
                href="https://usetollgate.com"
                className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                usetollgate.com
              </a>
              . The Python SDK installs in one line, the first policy takes five
              minutes to write, and your first Slack approval fires the same day.
            </p>
            <p className="text-body-md" style={proseText}>
              If you build something with tollgate, we&apos;d love to hear about it
              —{" "}
              <a
                href="mailto:hello@usetollgate.com"
                className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                hello@usetollgate.com
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
