export type Decision =
  | "allowed"
  | "denied"
  | "pending"
  | "approved"
  | "rejected";

export interface CheckResponse {
  action_id: string;
  decision: Decision;
  reason?: string;
}

export interface TollgateOptions {
  apiKey: string;
  /** default: "http://localhost:8000" */
  baseUrl?: string;
  /** default: false — on network error, allow or throw */
  failOpen?: boolean;
  /** default: 500 ms */
  pollIntervalMs?: number;
  /** default: 30000 ms */
  pollTimeoutMs?: number;
}
