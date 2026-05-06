import type {
  AgentWithKey,
  Agent,
  AuditResponse,
  Policy,
  Stats,
  PendingAction,
  Decision,
  HourlyBucket,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tg_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const authToken = token ?? getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error?.message ?? body.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Me
export interface Me {
  user_id: string;
  email: string;
  org_id: string;
  org_name: string;
}

export async function getMe(): Promise<Me> {
  return request<Me>("/auth/me");
}

// Auth
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, new_password: string): Promise<{ message: string }> {
  return request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) });
}

export async function login(
  email: string,
  password: string
): Promise<{ access_token: string }> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(
  email: string,
  password: string,
  org_name: string
): Promise<{ access_token: string }> {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, org_name }),
  });
}

// Agents
export async function getAgents(): Promise<Agent[]> {
  return request<Agent[]>("/agents");
}

export async function createAgent(name: string): Promise<AgentWithKey> {
  return request<AgentWithKey>("/agents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  return request<void>(`/agents/${id}`, { method: "DELETE" });
}

// Policies
export async function getActivePolicy(agentId: string): Promise<Policy | null> {
  try {
    return await request<Policy>(`/agents/${agentId}/policies/active`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function savePolicy(
  agentId: string,
  source_yaml: string
): Promise<Policy> {
  return request<Policy>(`/agents/${agentId}/policies`, {
    method: "POST",
    body: JSON.stringify({ source_yaml }),
  });
}

// Audit
export async function getAuditLog(params: {
  agent_id?: string;
  decision?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditResponse> {
  const q = new URLSearchParams();
  if (params.agent_id) q.set("agent_id", params.agent_id);
  if (params.decision) q.set("decision", params.decision);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return request<AuditResponse>(`/v1/audit?${q.toString()}`);
}

export async function getHourlyActivity(): Promise<HourlyBucket[]> {
  try {
    return await request<HourlyBucket[]>("/v1/audit/hourly");
  } catch {
    return [];
  }
}

// Stats
export async function getStats(): Promise<Stats> {
  return request<Stats>("/v1/stats");
}

// Pending actions
export async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const res = await getAuditLog({ decision: "pending", limit: 20 });
    return res.items.map((a) => ({
      id: a.id,
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      action_name: a.action_name,
      payload: a.payload,
      created_at: a.created_at,
    }));
  } catch {
    return [];
  }
}

// Decide
export async function decideAction(
  actionId: string,
  decision: "approved" | "rejected"
): Promise<void> {
  return request<void>(`/v1/check/${actionId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

// Recent activity (last 10 entries)
export async function getRecentActivity(
  limit = 10
): Promise<AuditResponse> {
  return getAuditLog({ limit });
}

// Slack
export interface SlackIntegration {
  id: string;
  team_id: string;
  team_name: string;
  installed_at: string;
}

export async function getSlackIntegration(): Promise<SlackIntegration | null> {
  try {
    return await request<SlackIntegration>("/integrations/slack");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function getSlackConnectUrl(): Promise<string> {
  const res = await request<{ url: string }>("/integrations/slack/connect-url");
  return res.url;
}

export async function disconnectSlack(): Promise<void> {
  return request<void>("/integrations/slack", { method: "DELETE" });
}
