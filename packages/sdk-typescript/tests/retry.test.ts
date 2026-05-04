import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Tollgate } from "../src/client.js";
import {
  TollgateAuthError,
  TollgateConnectionError,
} from "../src/errors.js";

const BASE_URL = "http://localhost:8000";

const server = setupServer();

// Use "warn" so failOpen tests hitting port 19999 (no MSW handler) don't emit
// error-level stderr; MSW will still pass the request through to the real network
// which refuses the connection, producing the expected TollgateConnectionError.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
afterAll(() => server.close());

function makeClient(opts: Partial<Parameters<typeof Tollgate>[0]> = {}) {
  return new Tollgate({
    apiKey: "test-key",
    baseUrl: BASE_URL,
    ...opts,
  });
}

describe("retry — 5xx handling", () => {
  it("retries on 5xx and succeeds on 2nd attempt", async () => {
    let attempts = 0;

    server.use(
      http.post(`${BASE_URL}/v1/check`, () => {
        attempts++;
        if (attempts === 1) {
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }
        return HttpResponse.json({ action_id: "act-retry", decision: "allowed" });
      }),
    );

    vi.useFakeTimers();
    const client = makeClient();
    const promise = client.checkAction("retry_action");

    // Advance past the first retry delay (500ms)
    await vi.advanceTimersByTimeAsync(600);

    const result = await promise;
    expect(result.decision).toBe("allowed");
    expect(attempts).toBe(2);
  });

  it("throws TollgateConnectionError after 3 consecutive 5xx failures", async () => {
    let attempts = 0;

    server.use(
      http.post(`${BASE_URL}/v1/check`, () => {
        attempts++;
        return HttpResponse.json({ error: "server error" }, { status: 503 });
      }),
    );

    vi.useFakeTimers();
    const client = makeClient();

    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const promise = client.checkAction("always_fails");
    const caught = promise.catch((e: unknown) => e);

    // Advance past all retry delays: 500 + 1000 + 2000 = 3500ms
    await vi.advanceTimersByTimeAsync(4000);

    const err = await caught;
    expect(err).toBeInstanceOf(TollgateConnectionError);
    expect(attempts).toBe(4); // initial + 3 retries
  });

  it("does not retry on 401 and throws TollgateAuthError immediately", async () => {
    let attempts = 0;

    server.use(
      http.post(`${BASE_URL}/v1/check`, () => {
        attempts++;
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );

    const client = makeClient();
    await expect(client.checkAction("auth_action")).rejects.toThrow(TollgateAuthError);
    expect(attempts).toBe(1);
  });

  it("does not retry on 422", async () => {
    let attempts = 0;

    server.use(
      http.post(`${BASE_URL}/v1/check`, () => {
        attempts++;
        return HttpResponse.json({ error: "Unprocessable entity" }, { status: 422 });
      }),
    );

    const client = makeClient();
    await expect(client.checkAction("bad_payload")).rejects.toThrow(TollgateConnectionError);
    expect(attempts).toBe(1);
  });
});

describe("retry — exponential backoff timing", () => {
  it("applies exponential backoff delays of 500ms, 1000ms, 2000ms", async () => {
    // Capture the delay values passed to setTimeout (our sleep() helper) without
    // disrupting the fake-timer machinery — we replace setTimeout with a wrapper
    // that records the delay and then calls the *real* fake-timer setTimeout with
    // delay=0 so the test runs quickly.
    const sleepCalls: number[] = [];

    server.use(
      http.post(`${BASE_URL}/v1/check`, () =>
        HttpResponse.json({ error: "server error" }, { status: 500 }),
      ),
    );

    vi.useFakeTimers();
    // Grab the fake-timer version of setTimeout that vi installed.
    const fakeSetTimeout = globalThis.setTimeout;

    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (typeof delay === "number" && delay > 0) {
          sleepCalls.push(delay);
        }
        // Schedule immediately so the loop keeps moving without manual advancement.
        return fakeSetTimeout(fn as () => void, 0, ...args);
      });

    const client = makeClient();
    const promise = client.checkAction("timing_action").catch(() => null);

    // With delay=0 the loop runs as micro/macro tasks; tick the event loop.
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    setTimeoutSpy.mockRestore();

    // Verify the three exponential-backoff delays were requested.
    const retryDelays = sleepCalls.filter((d) => d >= 500);
    expect(retryDelays).toContain(500);
    expect(retryDelays).toContain(1000);
    expect(retryDelays).toContain(2000);
  });
});

describe("retry — failOpen with connection error", () => {
  it("returns allowed when failOpen=true and connection is refused", async () => {
    const client = new Tollgate({
      apiKey: "test-key",
      baseUrl: "http://localhost:19999", // nothing listening
      failOpen: true,
    });

    const result = await client.checkAction("unreachable_action");
    expect(result.decision).toBe("allowed");
    expect(result.action_id).toBe("");
  });

  it("throws TollgateConnectionError when failOpen=false and connection is refused", async () => {
    const client = new Tollgate({
      apiKey: "test-key",
      baseUrl: "http://localhost:19999",
      failOpen: false,
    });

    await expect(client.checkAction("unreachable_action")).rejects.toThrow(
      TollgateConnectionError,
    );
  });
});
