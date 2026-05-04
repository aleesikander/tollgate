/**
 * Support Agent Example
 *
 * Demonstrates a Claude-powered support agent with three guarded tools,
 * each gated by the Tollgate policy layer before execution.
 *
 * Run:
 *   TOLLGATE_API_KEY=sk-... ANTHROPIC_API_KEY=sk-... npx tsx examples/support-agent.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { Tollgate } from "@tollgate/sdk";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const tg = new Tollgate({
  apiKey: process.env.TOLLGATE_API_KEY!,
  baseUrl: process.env.TOLLGATE_BASE_URL ?? "http://localhost:8000",
  failOpen: false,
  pollIntervalMs: 1000,
  pollTimeoutMs: 60_000,
});

// ---------------------------------------------------------------------------
// Guarded tool implementations
// ---------------------------------------------------------------------------

const issueRefund = tg.guard(
  "issue_refund",
  async (orderId: string, amount: number): Promise<string> => {
    // In production: call your payment provider API here
    console.log(`[tool] Issuing refund for order ${orderId}: $${amount}`);
    return `Refund of $${amount} issued for order ${orderId}. Confirmation #REF-${Date.now()}.`;
  },
  (orderId, amount) => ({ order_id: orderId, amount }),
);

const deleteAccount = tg.guard(
  "delete_account",
  async (customerId: string): Promise<string> => {
    // In production: call your account management API here
    console.log(`[tool] Deleting account for customer ${customerId}`);
    return `Account ${customerId} has been scheduled for deletion. Data will be purged in 30 days.`;
  },
  (customerId) => ({ customer_id: customerId }),
);

const escalateToHuman = tg.guard(
  "escalate_to_human",
  async (ticketId: string, reason: string): Promise<string> => {
    // In production: create a ticket in your support system
    console.log(`[tool] Escalating ticket ${ticketId}: ${reason}`);
    return `Ticket ${ticketId} escalated to human support team. Reason: ${reason}. ETA: 2-4 hours.`;
  },
  (ticketId, reason) => ({ ticket_id: ticketId, reason }),
);

// ---------------------------------------------------------------------------
// Claude tool definitions
// ---------------------------------------------------------------------------

const tools: Anthropic.Tool[] = [
  {
    name: "issue_refund",
    description:
      "Issue a monetary refund to a customer for a given order. Requires policy approval.",
    input_schema: {
      type: "object" as const,
      properties: {
        order_id: {
          type: "string",
          description: "The order ID to refund",
        },
        amount: {
          type: "number",
          description: "The refund amount in USD",
        },
      },
      required: ["order_id", "amount"],
    },
  },
  {
    name: "delete_account",
    description:
      "Permanently delete a customer account and all associated data. Requires policy approval.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: {
          type: "string",
          description: "The customer ID to delete",
        },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate a support ticket to a human agent when the issue cannot be resolved automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticket_id: {
          type: "string",
          description: "The ticket ID to escalate",
        },
        reason: {
          type: "string",
          description: "The reason for escalation",
        },
      },
      required: ["ticket_id", "reason"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

async function dispatchTool(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<string> {
  try {
    switch (toolName) {
      case "issue_refund":
        return await issueRefund(
          toolInput.order_id as string,
          toolInput.amount as number,
        );

      case "delete_account":
        return await deleteAccount(toolInput.customer_id as string);

      case "escalate_to_human":
        return await escalateToHuman(
          toolInput.ticket_id as string,
          toolInput.reason as string,
        );

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Tool execution failed: ${message}`;
  }
}

// ---------------------------------------------------------------------------
// Support agent loop
// ---------------------------------------------------------------------------

async function runSupportAgent(userMessage: string): Promise<void> {
  console.log(`\nUser: ${userMessage}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let continueLoop = true;

  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system:
        "You are a helpful customer support agent. You have access to tools to issue refunds, delete accounts, and escalate tickets. " +
        "Use tools when appropriate to help customers. Be concise and professional.",
      tools,
      messages,
    });

    // Collect text output
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`Assistant: ${block.text}`);
      }
    }

    if (response.stop_reason === "end_turn") {
      continueLoop = false;
      break;
    }

    if (response.stop_reason === "tool_use") {
      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`\n[Calling tool: ${block.name}]`);
          const result = await dispatchTool(
            block.name,
            block.input as Record<string, unknown>,
          );
          console.log(`[Tool result: ${result}]\n`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Append assistant turn and tool results
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    } else {
      continueLoop = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const scenario = process.argv[2] ?? "refund";

const scenarios: Record<string, string> = {
  refund:
    "Hi, I ordered product #ORDER-789 last week and it arrived damaged. I'd like a full refund of $59.99 please.",
  delete:
    "I want to close my account permanently. My customer ID is CUST-12345. Please delete all my data.",
  escalate:
    "I've been trying to resolve ticket TKT-5678 for two weeks with no success. I need to speak to a manager.",
};

const message = scenarios[scenario] ?? scenarios.refund;

runSupportAgent(message).catch((err) => {
  console.error("Agent error:", err);
  process.exit(1);
});
