"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, CheckCircle, ExternalLink, ChevronRight, MessageSquare, Unlink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getMe, getSlackIntegration, getSlackConnectUrl, disconnectSlack } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors flex-shrink-0"
    >
      {copied
        ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function FieldRow({
  label,
  value,
  mono = false,
  copyable = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between min-h-[52px] gap-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="text-sm text-muted-foreground w-36 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className={cn("text-sm text-foreground truncate", mono && "font-mono text-xs")}>
          {value}
        </span>
        {copyable && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function SettingSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid gap-10 py-8"
      style={{ gridTemplateColumns: "280px 1fr", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

const TABS = [
  { id: "general", label: "General" },
  { id: "api-keys", label: "API Keys" },
  { id: "slack", label: "Slack" },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [active, setActive] = useState(() => searchParams.get("tab") ?? "general");
  const queryClient = useQueryClient();

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const { data: slackIntegration, isLoading: slackLoading } = useQuery({
    queryKey: ["slack-integration"],
    queryFn: getSlackIntegration,
    staleTime: 30_000,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slack-integration"] });
      toast.success("Slack disconnected");
    },
    onError: () => toast.error("Failed to disconnect Slack"),
  });

  const [connecting, setConnecting] = useState(false);

  async function handleConnectSlack() {
    setConnecting(true);
    try {
      const url = await getSlackConnectUrl();
      window.location.href = url;
    } catch {
      toast.error("Failed to start Slack connection");
      setConnecting(false);
    }
  }

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "slack") toast.success("Slack connected successfully!");
    if (error === "slack_failed") toast.error("Slack connection failed. Please try again.");
  }, [searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col relative"
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 30% at 50% 0%, rgba(244,83,60,0.035) 0%, transparent 65%)",
        }}
      />

      {/* Header + tabs */}
      <div className="px-10 pt-8 pb-0 border-b border-border flex-shrink-0 relative">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          Manage your workspace and integrations
        </p>
        {/* Tab bar */}
        <div className="flex items-center gap-1 -mb-px relative">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors",
                active === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {active === id && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: "#F4533C" }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="px-10"
          >

            {/* ── General ──────────────────────────────────────────── */}
            {active === "general" && (
              <>
                <SettingSection
                  title="Organization"
                  description="Your workspace name and unique identifier. The organization ID is used to reference your workspace in the API."
                >
                  <div
                    className="rounded-xl px-6"
                    style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    {isLoading ? (
                      <div className="space-y-3 py-4">
                        <Skeleton className="h-10 rounded bg-secondary" />
                        <Skeleton className="h-10 rounded bg-secondary" />
                      </div>
                    ) : (
                      <>
                        <FieldRow label="Name" value={me?.org_name ?? "—"} copyable={false} />
                        <FieldRow label="Organization ID" value={me?.org_id ?? "—"} mono />
                      </>
                    )}
                  </div>
                </SettingSection>

                <SettingSection
                  title="Account"
                  description="Your personal account details associated with this workspace."
                >
                  <div
                    className="rounded-xl px-6"
                    style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    {isLoading ? (
                      <div className="space-y-3 py-4">
                        <Skeleton className="h-10 rounded bg-secondary" />
                        <Skeleton className="h-10 rounded bg-secondary" />
                      </div>
                    ) : (
                      <>
                        <FieldRow label="Email" value={me?.email ?? "—"} copyable={false} />
                        <FieldRow label="User ID" value={me?.user_id ?? "—"} mono />
                      </>
                    )}
                  </div>
                </SettingSection>
              </>
            )}

            {/* ── API Keys ─────────────────────────────────────────── */}
            {active === "api-keys" && (
              <>
                <SettingSection
                  title="Agent API keys"
                  description="Each agent has its own API key, generated at creation time. Keys are shown once — store them securely."
                >
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        API keys authenticate SDK calls to Tollgate on behalf of a specific agent.
                        They are scoped to that agent — one key cannot act as another agent.
                      </p>
                    </div>
                    <div className="px-6 py-4 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.018)" }}>
                      <div>
                        <p className="text-sm font-medium text-foreground">Manage agent keys</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Create agents and copy their API keys</p>
                      </div>
                      <Link
                        href="/agents"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        Go to Agents
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </SettingSection>

                <SettingSection
                  title="Authentication"
                  description="How to include your API key in requests to the Tollgate API."
                >
                  <div
                    className="rounded-xl px-6 py-5 space-y-4"
                    style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    <p className="text-sm text-muted-foreground">
                      Pass the key as a Bearer token in the{" "}
                      <code
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        Authorization
                      </code>{" "}
                      header:
                    </p>
                    <div
                      className="rounded-lg px-4 py-3 font-mono text-xs text-muted-foreground"
                      style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Authorization: Bearer{" "}
                      <span className="text-foreground">tg_live_••••••••••••••••••••••••</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The SDK handles this automatically — just pass{" "}
                      <code
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        api_key
                      </code>{" "}
                      to the constructor.
                    </p>
                  </div>
                </SettingSection>
              </>
            )}

            {/* ── Slack ────────────────────────────────────────────── */}
            {active === "slack" && (
              <>
                <SettingSection
                  title="Slack approvals"
                  description="When a policy rule requires human approval, Tollgate sends an interactive message to your Slack channel. Approve or reject without leaving Slack."
                >
                  <div
                    className="rounded-xl px-6 py-5"
                    style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      The agent SDK call blocks and polls for a decision. Once someone clicks
                      Approve or Reject in Slack, the decision is recorded in the audit log
                      and the agent resumes — or stops — accordingly.
                    </p>
                  </div>
                </SettingSection>

                <SettingSection
                  title="Workspace connection"
                  description="Connect your Slack workspace to enable approval notifications."
                >
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    {slackLoading ? (
                      <div className="px-6 py-5 flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Checking connection…</span>
                      </div>
                    ) : slackIntegration ? (
                      <div className="px-6 py-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(91,217,130,0.1)", border: "1px solid rgba(91,217,130,0.2)" }}
                          >
                            <MessageSquare className="w-4 h-4" style={{ color: "#5BD982" }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{slackIntegration.team_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Connected · {new Date(slackIntegration.installed_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => disconnectMutation.mutate()}
                          disabled={disconnectMutation.isPending}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          {disconnectMutation.isPending
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Unlink className="w-3.5 h-3.5" />}
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <div className="px-6 py-5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Not connected</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Connect Slack to receive approval notifications</p>
                        </div>
                        <button
                          onClick={handleConnectSlack}
                          disabled={connecting}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ background: "#F4533C", color: "#fff" }}
                        >
                          {connecting
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <MessageSquare className="w-3.5 h-3.5" />}
                          Connect Slack
                        </button>
                      </div>
                    )}
                  </div>
                </SettingSection>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
