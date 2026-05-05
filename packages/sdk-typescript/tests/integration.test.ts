/**
 * Integration tests — hit the real Tollgate API.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test -- integration
 */

import { describe, expect, it } from "vitest";
import { Tollgate } from "../src/client.js";
import {
  ActionDenied,
  ActionPending,
  TollgateAuthError,
  TollgateConnectionError,
} from "../src/errors.js";

const SKIP = process.env.RUN_INTEGRATION_TESTS !== "1";

const BASE_URL = "http://localhost:8000";
const API_KEY = "tg_live_3bdccda9390439d587e7a198dbcb4de1";

function makeClient(overrides: ConstructorParameters<typeof Tollgate>[0] = {}) {
  return new Tollgate({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    pollIntervalMs: 500,
    ...overrides,
  });
}

describe.skipIf(SKIP)("integration — checkAction", () => {
  it("test_check_allow: allowed immediately for low-amount refund", async () => {
    const tg = makeClient();
    const result = await tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" });
    expect(result.decision).toBe("allowed");
    expect(result.action_id).toBeTruthy();
  });

  it("test_check_deny: throws ActionDenied for high-amount refund", async () => {
    const tg = makeClient();
    await expect(
      tg.checkAction("issue_refund", { amount: 1000, customer_id: "c_int" }),
    ).rejects.toBeInstanceOf(ActionDenied);
  });

  it("test_check_default_deny: throws ActionDenied for unknown action", async () => {
    const tg = makeClient();
    await expect(tg.checkAction("unknown_action", {})).rejects.toBeInstanceOf(ActionDenied);
  });

  it("test_idempotency_auto_generated: two calls produce different action_ids", async () => {
    const tg = makeClient();
    const r1 = await tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" });
    const r2 = await tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" });
    expect(r1.action_id).not.toBe(r2.action_id);
  });

  it("test_idempotency_override: same key returns same action_id", async () => {
    const key = `int-idem-${crypto.randomUUID()}`;
    const tg = makeClient();
    const r1 = await tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" }, key);
    const r2 = await tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" }, key);
    expect(r1.action_id).toBe(r2.action_id);
  });
});

describe.skipIf(SKIP)("integration — guard", () => {
  it("test_guard_allow: fn is called when policy allows", async () => {
    const tg = makeClient();
    const called: boolean[] = [];

    const guarded = tg.guard(
      "issue_refund",
      (amount: number, customerId: string) => {
        called.push(true);
        return `refunded ${amount} for ${customerId}`;
      },
      (amount, customerId) => ({ amount, customer_id: customerId }),
    );

    const result = await guarded(30, "c_int");
    expect(result).toBe("refunded 30 for c_int");
    expect(called).toHaveLength(1);
  });

  it("test_guard_deny: fn is NOT called when policy denies", async () => {
    const tg = makeClient();
    const called: boolean[] = [];

    const guarded = tg.guard(
      "issue_refund",
      (amount: number, customerId: string) => {
        called.push(true);
        return `refunded ${amount} for ${customerId}`;
      },
      (amount, customerId) => ({ amount, customer_id: customerId }),
    );

    await expect(guarded(1000, "c_int")).rejects.toBeInstanceOf(ActionDenied);
    expect(called).toHaveLength(0);
  });

  it("test_guard_with_payload_mapper: mapper shapes payload, policy reacts correctly", async () => {
    const tg = makeClient();

    const guarded = tg.guard(
      "issue_refund",
      (amount: number, internalRef: string) => `done:${internalRef}`,
      (amount, _internalRef) => ({ amount, customer_id: "c_mapper" }),
    );

    const result = await guarded(30, "internal-only");
    expect(result).toBe("done:internal-only");
  });

  it("test_guard_no_mapper_uses_first_arg: object arg becomes payload when no mapper provided", async () => {
    const tg = makeClient();
    const called: string[] = [];

    // Customer-idiomatic pattern: function takes single object, no mapper provided.
    // This is the same calling pattern the smoke test uses. Bug v0.6: this sent {}.
    const guarded = tg.guard(
      "issue_refund",
      async (args: { amount: number; customer_id: string }) => {
        called.push(`refunded ${args.amount}`);
        return `ok ${args.amount}`;
      },
    );

    const result = await guarded({ amount: 30, customer_id: "c_no_mapper" });
    expect(result).toBe("ok 30");
    expect(called).toEqual(["refunded 30"]);
  });

  it("test_guard_no_mapper_payload_actually_evaluated: deny reason proves payload was forwarded", async () => {
    const tg = makeClient();

    // If guard() sent {} instead of args, the policy would default-deny with
    // "no matching rule for action 'issue_refund'". Matching the specific
    // "Refund exceeds maximum" reason proves the policy saw amount: 1000.
    const guarded = tg.guard(
      "issue_refund",
      async (_args: { amount: number; customer_id: string }) => {
        return "should not run";
      },
    );

    await expect(
      guarded({ amount: 1000, customer_id: "c_no_mapper" })
    ).rejects.toThrow(/Refund exceeds maximum allowed amount/);
  });
});

describe.skipIf(SKIP)("integration — withCheck", () => {
  it("test_with_check_allow: fn is called when policy allows", async () => {
    const tg = makeClient();
    const executed: boolean[] = [];

    await tg.withCheck(
      "issue_refund",
      { amount: 30, customer_id: "c_int" },
      () => { executed.push(true); },
    );

    expect(executed).toHaveLength(1);
  });

  it("test_with_check_deny: fn is NOT called when policy denies", async () => {
    const tg = makeClient();
    const executed: boolean[] = [];

    await expect(
      tg.withCheck(
        "issue_refund",
        { amount: 1000, customer_id: "c_int" },
        () => { executed.push(true); },
      ),
    ).rejects.toBeInstanceOf(ActionDenied);

    expect(executed).toHaveLength(0);
  });
});

describe.skipIf(SKIP)("integration — error handling", () => {
  it("test_auth_error: invalid key throws TollgateAuthError", async () => {
    const tg = new Tollgate({ apiKey: "tg_live_invalid_key", baseUrl: BASE_URL });
    await expect(
      tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" }),
    ).rejects.toBeInstanceOf(TollgateAuthError);
  });

  it("test_connection_error_fail_closed: unreachable URL throws TollgateConnectionError", async () => {
    const tg = new Tollgate({ apiKey: API_KEY, baseUrl: "http://localhost:19999" });
    await expect(
      tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" }),
    ).rejects.toBeInstanceOf(TollgateConnectionError);
  });

  it("test_connection_error_fail_open: unreachable URL with failOpen returns allowed", async () => {
    const tg = new Tollgate({
      apiKey: API_KEY,
      baseUrl: "http://localhost:19999",
      failOpen: true,
    });
    const result = await tg.checkAction("issue_refund", { amount: 30, customer_id: "c_int" });
    expect(result.decision).toBe("allowed");
  });
});

describe.skipIf(SKIP)("integration — pending (poll timeout)", () => {
  it("test_pending_returns_action_id: ActionPending carries a non-empty action_id", async () => {
    const tg = makeClient({ pollIntervalMs: 200, pollTimeoutMs: 500 });
    let caught: ActionPending | null = null;
    try {
      await tg.checkAction("issue_refund", { amount: 200, customer_id: "c_int" });
    } catch (err) {
      if (err instanceof ActionPending) caught = err;
      else throw err;
    }
    expect(caught).toBeInstanceOf(ActionPending);
    expect(caught!.actionId).toBeTruthy();
  });
});
