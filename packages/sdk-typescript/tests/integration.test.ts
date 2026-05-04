/**
 * Integration tests — hit a real running Tollgate API.
 *
 * Run with:
 *   TOLLGATE_API_URL=http://localhost:8000 \
 *   TOLLGATE_API_KEY=tg_live_... \
 *   RUN_INTEGRATION_TESTS=1 \
 *   npm test
 *
 * Prerequisites:
 *   - API server running at TOLLGATE_API_URL
 *   - Agent with API key TOLLGATE_API_KEY registered
 *   - Active policy that allows "integration_allow_test" and denies "integration_deny_test"
 *     Example policy:
 *       version: 1
 *       rules:
 *         - action: integration_deny_test
 *           decide: deny
 *           reason: "Integration test deny"
 *       default: allow
 */

import { describe, it, expect } from "vitest";
import { Tollgate } from "../src/client.js";
import { ActionDenied, TollgateAuthError } from "../src/errors.js";

const RUN = !!process.env.RUN_INTEGRATION_TESTS;

describe.skipIf(!RUN)("integration — real API calls", () => {
  const apiUrl = process.env.TOLLGATE_API_URL ?? "http://localhost:8000";
  const apiKey = process.env.TOLLGATE_API_KEY ?? "";

  it("allows an action that the policy permits", async () => {
    const tg = new Tollgate({ apiKey, baseUrl: apiUrl });
    const result = await tg.checkAction("integration_allow_test", { source: "sdk-ts-integration" });
    expect(result.decision).toBe("allowed");
    expect(result.action_id).toBeTruthy();
  });

  it("throws ActionDenied for an action the policy denies", async () => {
    const tg = new Tollgate({ apiKey, baseUrl: apiUrl });
    await expect(
      tg.checkAction("integration_deny_test", { source: "sdk-ts-integration" }),
    ).rejects.toThrow(ActionDenied);
  });

  it("uses caller-supplied idempotency_key — repeated call returns same decision", async () => {
    const tg = new Tollgate({ apiKey, baseUrl: apiUrl });
    const key = `ts-idem-${Date.now()}`;
    const r1 = await tg.checkAction("integration_allow_test", {}, key);
    const r2 = await tg.checkAction("integration_allow_test", {}, key);
    // Idempotent: same action_id, same decision
    expect(r1.action_id).toBe(r2.action_id);
    expect(r1.decision).toBe("allowed");
  });

  it("throws TollgateAuthError for an invalid API key", async () => {
    const tg = new Tollgate({ apiKey: "tg_live_invalid_key_000", baseUrl: apiUrl });
    await expect(
      tg.checkAction("integration_allow_test", {}),
    ).rejects.toThrow(TollgateAuthError);
  });

  it("guard() wraps a function and allows it through", async () => {
    const tg = new Tollgate({ apiKey, baseUrl: apiUrl });
    const fn = tg.guard(
      "integration_allow_test",
      async (x: number) => x * 2,
    );
    const result = await fn(21);
    expect(result).toBe(42);
  });
});
