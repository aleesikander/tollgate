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
  id: string;
  agent_id: string;
  agent_name?: string;
  action_name: string;
  decision: Decision;
  payload: Record<string, unknown>;
  reason?: string;
  decided_by?: string;
  created_at: string;
  decided_at?: string;
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
