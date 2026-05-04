import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Tollgate } from "../src/client.js";
import { ActionDenied } from "../src/errors.js";

const BASE_URL = "http://localhost:8000";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function makeClient() {
  return new Tollgate({
    apiKey: "test-key",
    baseUrl: BASE_URL,
    pollIntervalMs: 10,
  });
}

function allowHandler() {
  return http.post(`${BASE_URL}/v1/check`, () =>
    HttpResponse.json({ action_id: "act-1", decision: "allowed" }),
  );
}

function denyHandler() {
  return http.post(`${BASE_URL}/v1/check`, () =>
    HttpResponse.json({ action_id: "act-2", decision: "denied", reason: "not allowed" }),
  );
}

describe("guard — wrapping functions", () => {
  it("wraps a sync function and calls checkAction before invoking it", async () => {
    server.use(allowHandler());
    const client = makeClient();

    let called = false;
    const guarded = client.guard("test_action", () => {
      called = true;
      return "result";
    });

    const result = await guarded();
    expect(called).toBe(true);
    expect(result).toBe("result");
  });

  it("wraps an async function and awaits it correctly", async () => {
    server.use(allowHandler());
    const client = makeClient();

    const guarded = client.guard("async_action", async (x: number) => {
      await Promise.resolve();
      return x * 2;
    });

    const result = await guarded(21);
    expect(result).toBe(42);
  });

  it("passes through the function return value", async () => {
    server.use(allowHandler());
    const client = makeClient();

    const guarded = client.guard("return_action", () => ({ key: "value", count: 5 }));
    const result = await guarded();

    expect(result).toEqual({ key: "value", count: 5 });
  });

  it("calls fn with original args", async () => {
    server.use(allowHandler());
    const client = makeClient();

    const receivedArgs: unknown[] = [];
    const guarded = client.guard("multi_arg_action", (a: string, b: number, c: boolean) => {
      receivedArgs.push(a, b, c);
    });

    await guarded("hello", 42, true);
    expect(receivedArgs).toEqual(["hello", 42, true]);
  });

  it("works with multiple arguments", async () => {
    server.use(allowHandler());
    const client = makeClient();

    const guarded = client.guard(
      "multi_action",
      (a: string, b: number) => `${a}-${b}`,
    );

    const result = await guarded("foo", 7);
    expect(result).toBe("foo-7");
  });
});

describe("guard — payloadMapper", () => {
  it("uses payloadMapper to extract payload from args", async () => {
    let capturedBody: Record<string, unknown> = {};

    server.use(
      http.post(`${BASE_URL}/v1/check`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ action_id: "act-map", decision: "allowed" });
      }),
    );

    const client = makeClient();
    const guarded = client.guard(
      "refund_action",
      (orderId: string, amount: number) => `refunded ${orderId} for ${amount}`,
      (orderId, amount) => ({ order_id: orderId, amount }),
    );

    await guarded("order-123", 99.99);

    expect(capturedBody.payload).toEqual({ order_id: "order-123", amount: 99.99 });
  });

  it("sends empty payload when no payloadMapper is provided", async () => {
    let capturedBody: Record<string, unknown> = {};

    server.use(
      http.post(`${BASE_URL}/v1/check`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ action_id: "act-empty", decision: "allowed" });
      }),
    );

    const client = makeClient();
    const guarded = client.guard("no_mapper_action", (x: string) => x.toUpperCase());

    await guarded("hello");

    expect(capturedBody.payload).toEqual({});
  });
});

describe("guard — denied behaviour", () => {
  it("throws ActionDenied and does not call fn when denied", async () => {
    server.use(denyHandler());
    const client = makeClient();

    let fnCalled = false;
    const guarded = client.guard("denied_action", () => {
      fnCalled = true;
      return "should not reach";
    });

    await expect(guarded()).rejects.toThrow(ActionDenied);
    expect(fnCalled).toBe(false);
  });

  it("throws ActionDenied with the deny reason", async () => {
    server.use(denyHandler());
    const client = makeClient();

    const guarded = client.guard("denied_action", () => "x");
    const err = await guarded().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ActionDenied);
    expect((err as ActionDenied).reason).toBe("not allowed");
  });
});

describe("guard — allowed behaviour", () => {
  it("calls fn with original args when allowed", async () => {
    server.use(allowHandler());
    const client = makeClient();

    const spy = vi.fn((a: string, b: number) => `${a}:${b}`);
    const guarded = client.guard("allowed_action", spy);

    await guarded("x", 10);

    expect(spy).toHaveBeenCalledWith("x", 10);
  });
});
