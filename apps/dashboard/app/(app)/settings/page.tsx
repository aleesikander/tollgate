"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, CheckCircle, ExternalLink, ChevronRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { getMe } from "@/lib/api";
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
  const [active, setActive] = useState("general");

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 60_000,
  });

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
                  title="Setup guide"
                  description="Connect your Slack workspace to enable approval notifications. Takes about 5 minutes."
                >
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    <div>
                      {[
                        {
                          n: "1",
                          title: "Create a Slack App",
                          body: (
                            <>
                              Go to{" "}
                              <a
                                href="https://api.slack.com/apps"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 underline underline-offset-2"
                              >
                                api.slack.com/apps
                              </a>{" "}
                              and create a new app. Under{" "}
                              <span className="text-foreground font-medium">OAuth &amp; Permissions</span>, add bot scopes:{" "}
                              <code
                                className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                              >
                                chat:write
                              </code>{" "}
                              <code
                                className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                              >
                                channels:read
                              </code>
                            </>
                          ),
                        },
                        {
                          n: "2",
                          title: "Set environment variables",
                          body: (
                            <div
                              className="font-mono text-xs text-muted-foreground space-y-1 mt-2 rounded-lg px-4 py-3"
                              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              <div><span className="text-foreground">SLACK_BOT_TOKEN</span>=xoxb-...</div>
                              <div><span className="text-foreground">SLACK_SIGNING_SECRET</span>=...</div>
                              <div><span className="text-foreground">ENCRYPTION_KEY</span>=your-fernet-key</div>
                            </div>
                          ),
                        },
                        {
                          n: "3",
                          title: "Configure Interactivity",
                          body: (
                            <>
                              Enable{" "}
                              <span className="text-foreground font-medium">Interactivity &amp; Shortcuts</span>{" "}
                              and set the Request URL:
                              <div
                                className="font-mono text-xs text-muted-foreground mt-2 rounded-lg px-4 py-2.5"
                                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                              >
                                https://your-domain.com/slack/interactive
                              </div>
                            </>
                          ),
                        },
                        {
                          n: "4",
                          title: "Invite the bot to your channel",
                          body: (
                            <>
                              In Slack, run{" "}
                              <code
                                className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                              >
                                /invite @tollgate
                              </code>{" "}
                              in the channel you want approval requests sent to.
                            </>
                          ),
                        },
                      ].map(({ n, title, body }) => (
                        <div
                          key={n}
                          className="px-6 py-5 flex gap-4"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: "rgba(244,83,60,0.1)", border: "1px solid rgba(244,83,60,0.22)" }}
                          >
                            <span className="text-[10px] font-bold" style={{ color: "#F4533C" }}>{n}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground mb-1.5">{title}</p>
                            <div className="text-sm text-muted-foreground leading-relaxed">{body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Full guide in the{" "}
                      <a
                        href="/docs/integrations/slack"
                        className="text-primary hover:text-primary/80 underline underline-offset-2"
                      >
                        Slack integration docs
                      </a>
                    </span>
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
