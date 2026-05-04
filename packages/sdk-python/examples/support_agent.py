"""
Tollgate Example: AI Support Agent

A support agent backed by Claude that uses Tollgate to gate risky actions.
Three tools are protected: issue_refund, update_account, escalate_to_human.

Run: python support_agent.py
"""

import os
import sys

import anthropic

from tollgate import ActionDenied, ActionPending, Tollgate

TOLLGATE_API_KEY = os.environ.get("TOLLGATE_API_KEY", "")
TOLLGATE_BASE_URL = os.environ.get("TOLLGATE_BASE_URL", "http://localhost:8000")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

if not TOLLGATE_API_KEY:
    print("Error: TOLLGATE_API_KEY is not set.")
    sys.exit(1)
if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY is not set.")
    sys.exit(1)

tg = Tollgate(
    api_key=TOLLGATE_API_KEY,
    base_url=TOLLGATE_BASE_URL,
    on_pending=lambda action_id: print(f"\n[Tollgate] Waiting for approval in Slack... (action_id={action_id})"),
    poll_interval=3.0,
    max_wait=300.0,
)

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "issue_refund",
        "description": "Issue a refund to a customer for a specified amount.",
        "input_schema": {
            "type": "object",
            "properties": {
                "amount": {"type": "number", "description": "Refund amount in USD"},
                "customer_id": {"type": "string", "description": "Customer identifier"},
                "reason": {"type": "string", "description": "Reason for the refund"},
            },
            "required": ["amount", "customer_id"],
        },
    },
    {
        "name": "update_account",
        "description": "Update a customer's account information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "string", "description": "Customer identifier"},
                "field": {"type": "string", "description": "Field to update (email, plan, etc.)"},
                "value": {"type": "string", "description": "New value for the field"},
            },
            "required": ["customer_id", "field", "value"],
        },
    },
    {
        "name": "escalate_to_human",
        "description": "Escalate this support case to a human agent.",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "string", "description": "Customer identifier"},
                "reason": {"type": "string", "description": "Reason for escalation"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "Priority level"},
            },
            "required": ["customer_id", "reason"],
        },
    },
]


@tg.guard("issue_refund")
def issue_refund(amount: float, customer_id: str, reason: str = "") -> dict:  # type: ignore[return]
    """Execute the refund (would call Stripe in production)."""
    print(f"[Tool] Issuing refund: ${amount} to {customer_id}")
    return {"status": "refunded", "amount": amount, "customer_id": customer_id}


@tg.guard("update_account")
def update_account(customer_id: str, field: str, value: str) -> dict:  # type: ignore[return]
    """Execute the account update (would call your DB in production)."""
    print(f"[Tool] Updating {field}={value} for {customer_id}")
    return {"status": "updated", "customer_id": customer_id, "field": field, "value": value}


@tg.guard("escalate_to_human")
def escalate_to_human(customer_id: str, reason: str, priority: str = "medium") -> dict:  # type: ignore[return]
    """Escalate to a human agent."""
    print(f"[Tool] Escalating {customer_id} — {reason} (priority={priority})")
    return {"status": "escalated", "customer_id": customer_id, "ticket_id": "TKT-001"}


def run_tool(name: str, inputs: dict) -> str:  # type: ignore[type-arg]
    """Dispatch a tool call, catching Tollgate exceptions."""
    try:
        if name == "issue_refund":
            result = issue_refund(**inputs)
        elif name == "update_account":
            result = update_account(**inputs)
        elif name == "escalate_to_human":
            result = escalate_to_human(**inputs)
        else:
            return f"Unknown tool: {name}"
        return str(result)
    except ActionDenied as e:
        return f"[Tollgate] Action denied: {e.reason}"
    except ActionPending as e:
        return f"[Tollgate] Approval timed out after {e.timeout_seconds}s for action {e.action_id}"


def chat_loop() -> None:
    """Run the support agent loop."""
    print("Tollgate Support Agent — type 'quit' to exit")
    print(f"Connected to Tollgate at {TOLLGATE_BASE_URL}\n")
    messages: list[dict] = []  # type: ignore[type-arg]

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        if user_input.lower() in ("quit", "exit", "q"):
            print("Goodbye.")
            break
        if not user_input:
            continue

        messages.append({"role": "user", "content": user_input})

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=(
                "You are a helpful customer support agent. "
                "Use the available tools to help customers with refunds, account updates, and escalations. "
                "Always confirm the customer_id before taking actions."
            ),
            tools=TOOLS,  # type: ignore[arg-type]
            messages=messages,  # type: ignore[arg-type]
        )

        while response.stop_reason == "tool_use":
            tool_results = []
            assistant_content = []

            for block in response.content:
                assistant_content.append(block)
                if block.type == "tool_use":
                    print(f"\n[Agent] Calling {block.name}({block.input})")
                    result = run_tool(block.name, block.input)  # type: ignore[arg-type]
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            messages.append({"role": "assistant", "content": assistant_content})
            messages.append({"role": "user", "content": tool_results})

            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=(
                    "You are a helpful customer support agent. "
                    "Use the available tools to help customers with refunds, account updates, and escalations."
                ),
                tools=TOOLS,  # type: ignore[arg-type]
                messages=messages,  # type: ignore[arg-type]
            )

        # Extract final text response
        reply = ""
        for block in response.content:
            if hasattr(block, "text"):
                reply += block.text

        messages.append({"role": "assistant", "content": response.content})
        print(f"\nAgent: {reply}\n")


if __name__ == "__main__":
    chat_loop()
