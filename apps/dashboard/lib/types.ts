export interface User {
  id: string;
  email: string;
  org_id: string;
  org_name: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface Agent {
  id: string;
  name: string;
  org_id: string;
  created_at: string;
  action_count?: number;
}

export interface AgentWithKey extends Agent {
  api_key: string;
}

export interface Policy {
  id: string;
  agent_id: string;
  version: number;
  source_yaml: string;
  created_at: string;
  is_active: boolean;
}

export type Decision = "allowed" | "denied" | "pending" | "approved" | "rejected";

export interface AuditEntry {
  // Core identity
  id: string;
  idempotency_key: string;
  agent_id: string;
  agent_name?: string;

  // What happened
  action_name: string;
  payload: Record<string, unknown>;

  // Decision
  decision: Decision;
  decision_source: "policy" | "human" | "expired";
  reason?: string;
  created_at: string;
  decided_at?: string;

  // Human approval details
  decided_by?: string;           // approver email
  decided_by_user_id?: string;

  // Approval request metadata
  approval_status?: string;
  approval_requested_at?: string;
  approval_decided_at?: string;
  approval_expires_at?: string;
  slack_channel?: string;
  approvers_config?: Record<string, unknown>;
}

export interface AuditResponse {
  items: AuditEntry[];
  total: number;
}

export interface Stats {
  agent_count: number;
  pending_count: number;
  actions_today: number;
}

export interface PendingAction {
  id: string;
  agent_id: string;
  agent_name?: string;
  action_name: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface HourlyBucket {
  hour: string;
  allowed: number;
  denied: number;
  pending: number;
}
