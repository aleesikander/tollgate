import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Tollgate } from "../src/client.js";
import {
  ActionDenied,
  ActionPending,
  TollgateAuthError,
  TollgateConnectionError,
} from "../src/errors.js";

const BASE_URL = "http://localhost:8000";

const server = setupServer();

// Use "warn" so that the failOpen tests (which hit a real port 19999 that has
// no MSW handler) don't produce noisy stderr errors. The actual fetch will
// still fail with a connection-refused error after MSW passes it through.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeClient(opts: Partial<Parameters<typeof Tollgate>[0]> = {}) {
  return new Tollgate({
    apiKey: "test-key",
    baseUrl: BASE_URL,
    pollIntervalMs: 10,
    pollTimeoutMs: 5000,
    ...opts,
  });
}

describe("checkAction — immediate decisions", () => {
  it("returns allowed immediately", async () => {
    server.use(
      http.post(`${BASE_URL}/v1/check`, () =>
        HttpResponse.json({ action_id: "act-1", decision: "allowed" }),
      ),
    );

    const client = makeClient();
    const result = await client.checkAction("send_email", { to: "user@example.com" });

    expect(result.action_id).toBe("act-1");
    expect(result.decision).toBe("allowed");
  });

  it("throws ActionDenied when decision is denied", async () => {
    server.use(
      http.post(`${BASE_URL}/v1/check`, () =>
        HttpResponse.json({ action_id: "act-2", decision: "denied", reason: "policy violation" }),
      ),
    );

    const client = makeClient();
    await expect(client.checkAction("delete_user")).rejects.toThrow(ActionDenied);
    await expect(client.checkAction("delete_user")).rejects.toThrow("policy violation");
  });

  it("throws TollgateAuthError on 401", async () => {
    server.use(
      http.post(`${BASE_URL}/v1/check`, () =>
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    );

    const client = makeClient();
    await expect(client.checkAction("do_thing")).rejects.toThrow(TollgateAuthError);
  });
});

describe("checkAction — polling", () => {
  it("polls until approved and returns allowed", async () => {
    let pollCount = 0;

    server.use(
      http.post(`${BASE_URL}/v1/check`, () =>
        HttpResponse.json({ action_id: "act-poll-1", decision: "pending" }),
      ),
      http.get(`${BASE_URL}/v1/check/act-poll-1`, () => {
        pollCount++;
        if (pollCount < 2) {
          return HttpResponse.json({ action_id: "act-poll-1", decision: "pending" });
        }
        return HttpResponse.json({ action_id: "act-poll-1", decision: "approved" });
      }),
    );

    const client = makeClient();
    const result = await client.checkAction("send_payment");

    expect(result.decision).toBe("allowed");
    expect(pollCount).toBeGreaterThanOrEqual(2);
  });

  it("polls until rejected and throws ActionDenied", async () => {
    server.use(
      http.post(`${BASE_URL}/v1/check`, () =>
        HttpResponse.json({ action_id: "act-poll-2", decision: "pending" }),
      ),
      http.get(`${BASE_URL}/v1/check/act-poll-2`, () =>
        HttpResponse.json({ action_id: "act-poll-2", decision: "rejected", reason: "human said no" }),
      ),
    );

    const client = makeClient();
    await expect(client.checkAction("delete_database")).rejects.toThrow(ActionDenied);
    await expect(client.checkAction("delete_database")).rejects.toThrow("human said no");
  });

  it("throws ActionPending when poll timeout is exceeded", async () => {
    server.use(
      http.post(`${BASE_URL}/v1/check`, () =>
        HttpResponse.json({ action_id: "act-timeout", decision: "pending" }),
      ),
      http.get(`${BASE_URL}/v1/check/act-timeout`, () =>
        HttpResponse.json({ action_id: "act-timeout", decision: "pending" }),
      ),
    );

    const client = makeClient({ pollIntervalMs: 10, pollTimeoutMs: 50 });
    const err = await client.checkAction("slow_action").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ActionPending);
    expect((err as ActionPending).actionId).toBe("act-timeout");
  });
});

describe("checkAction — failOpen", () => {
  it("returns allowed when failOpen=true and network error occurs", async () => {
    // No handlers — fetch will fail with connection refused (we use a bad port)
    const client = new Tollgate({
      apiKey: "test-key",
      baseUrl: "http://localhost:19999", // nothing listening here
      failOpen: true,
    });

    const result = await client.checkAction("some_action");
    expect(result.decision).toBe("allowed");
    expect(result.action_id).toBe("");
  });

  it("throws TollgateConnectionError when failOpen=false and network error occurs", async () => {
    const client = new Tollgate({
      apiKey: "test-key",
      baseUrl: "http://localhost:19999",
      failOpen: false,
    });

    await expect(client.checkAction("some_action")).rejects.toThrow(TollgateConnectionError);
  });
});

describe("checkAction — request details", () => {
  it("sends idempotency key in request body when provided", async () => {
    let capturedBody: Record<string, unknown> = {};

    server.use(
      http.post(`${BASE_URL}/v1/check`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ action_id: "act-idem", decision: "allowed" });
      }),
    );

    const client = makeClient();
    await client.checkAction("send_email", { to: "a@b.com" }, "my-idem-key");

    expect(capturedBody.idempotency_key).toBe("my-idem-key");
    expect(capturedBody.action_name).toBe("send_email");
    expect(capturedBody.payload).toEqual({ to: "a@b.com" });
  });

  it("auto-generates a UUID idempotency_key when none is provided", async () => {
    const capturedKeys: string[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/check`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        capturedKeys.push(body.idempotency_key as string);
        return HttpResponse.json({ action_id: "act-auto-idem", decision: "allowed" });
      }),
    );

    const client = makeClient();
    await client.checkAction("send_email", { to: "a@b.com" });
    await client.checkAction("send_email", { to: "b@b.com" });

    // Each call must produce a non-empty key
    expect(capturedKeys[0]).toBeTruthy();
    expect(capturedKeys[1]).toBeTruthy();
    // Each call must produce a different key (truly per-call)
    expect(capturedKeys[0]).not.toBe(capturedKeys[1]);
    // Must be a valid UUID v4 format
    expect(capturedKeys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("uses custom baseUrl", async () => {
    const customBase = "http://custom-host:9999";
    let called = false;

    server.use(
      http.post(`${customBase}/v1/check`, () => {
        called = true;
        return HttpResponse.json({ action_id: "act-custom", decision: "allowed" });
      }),
    );

    const client = new Tollgate({
      apiKey: "key",
      baseUrl: customBase,
    });

    await client.checkAction("test_action");
    expect(called).toBe(true);
  });
});
