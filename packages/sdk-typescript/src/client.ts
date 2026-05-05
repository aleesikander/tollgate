import {
  ActionDenied,
  ActionPending,
  TollgateAuthError,
  TollgateConnectionError,
} from "./errors.js";
import type { CheckResponse, TollgateOptions } from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_TIMEOUT_MS = 300_000;
const RETRY_DELAYS_MS = [500, 1000, 2000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Tollgate {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly failOpen: boolean;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;

  constructor(options: TollgateOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.failOpen = options.failOpen ?? false;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * POST /v1/check with automatic retry on 5xx (3 attempts, exponential backoff).
   * Always sends idempotency_key — auto-generated via crypto.randomUUID() if not supplied.
   */
  private async postCheck(
    actionName: string,
    payload: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<CheckResponse> {
    const url = `${this.baseUrl}/v1/check`;
    const body = {
      action_name: actionName,
      payload,
      idempotency_key: idempotencyKey ?? crypto.randomUUID(),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: this.authHeaders,
          body: JSON.stringify(body),
        });
      } catch (err) {
        // Network / connection error
        const msg = err instanceof Error ? err.message : String(err);
        lastError = new TollgateConnectionError(msg);
        // Do not retry on connection errors — break immediately
        break;
      }

      if (response.status === 401) {
        throw new TollgateAuthError("Unauthorized: invalid API key");
      }

      if (response.status === 422) {
        const text = await response.text();
        throw new TollgateConnectionError(`Unprocessable entity: ${text}`);
      }

      if (response.status >= 500) {
        const text = await response.text().catch(() => "");
        lastError = new TollgateConnectionError(
          `Server error ${response.status}: ${text}`,
        );
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }

      // Success
      const data = (await response.json()) as CheckResponse;
      return data;
    }

    // Exhausted retries or connection error
    if (this.failOpen) {
      return { action_id: "", decision: "allowed" };
    }
    throw lastError ?? new TollgateConnectionError("Unknown error");
  }

  /**
   * Poll GET /v1/check/{actionId} until a terminal decision or timeout.
   */
  private async poll(actionId: string): Promise<CheckResponse> {
    const deadline = Date.now() + this.pollTimeoutMs;

    while (Date.now() < deadline) {
      await sleep(this.pollIntervalMs);

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/v1/check/${actionId}`, {
          headers: this.authHeaders,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (this.failOpen) {
          return { action_id: actionId, decision: "allowed" };
        }
        throw new TollgateConnectionError(msg);
      }

      const data = (await response.json()) as CheckResponse;

      if (data.decision === "approved" || data.decision === "allowed") {
        return { ...data, decision: "allowed" };
      }

      if (data.decision === "rejected" || data.decision === "denied") {
        throw new ActionDenied(data.reason);
      }

      // Still pending — keep polling
    }

    throw new ActionPending(actionId);
  }

  /**
   * Submit an action for policy evaluation.
   *
   * - Returns immediately on `allowed`.
   * - Polls on `pending` until `approved`/`rejected`/`allowed`/`denied` or timeout.
   * - Throws `ActionDenied` on `denied` or `rejected`.
   * - Throws `ActionPending` when poll timeout is exceeded.
   * - Throws `TollgateAuthError` on 401.
   * - Throws `TollgateConnectionError` on network failure (unless `failOpen=true`).
   */
  async checkAction(
    actionName: string,
    payload: Record<string, unknown> = {},
    idempotencyKey?: string,
  ): Promise<CheckResponse> {
    const result = await this.postCheck(actionName, payload, idempotencyKey);

    if (result.decision === "allowed" || result.decision === "approved") {
      return { ...result, decision: "allowed" };
    }

    if (result.decision === "denied" || result.decision === "rejected") {
      throw new ActionDenied(result.reason);
    }

    // Pending — poll
    return this.poll(result.action_id);
  }

  /**
   * Wraps a function with a policy check.
   *
   * Returns a new async function that calls `checkAction` before invoking `fn`.
   * If `payloadMapper` is provided, it is called with the function's arguments to
   * produce the payload; otherwise an empty object is sent.
   * Pass `idempotencyKey` to use a fixed key for every invocation of the wrapped function.
   */
  guard<TArgs extends unknown[], TReturn>(
    actionName: string,
    fn: (...args: TArgs) => TReturn | Promise<TReturn>,
    payloadMapper?: (...args: TArgs) => Record<string, unknown>,
    idempotencyKey?: string,
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      const payload = payloadMapper
        ? payloadMapper(...args)
        : (args.length === 1 && typeof args[0] === "object" && args[0] !== null
            ? (args[0] as Record<string, unknown>)
            : {});
      await this.checkAction(actionName, payload, idempotencyKey);
      return fn(...args);
    };
  }

  /**
   * Context-manager pattern: check policy then execute `fn` if allowed.
   */
  async withCheck<TReturn>(
    actionName: string,
    payload: Record<string, unknown>,
    fn: () => TReturn | Promise<TReturn>,
    idempotencyKey?: string,
  ): Promise<TReturn> {
    await this.checkAction(actionName, payload, idempotencyKey);
    return fn();
  }
}
