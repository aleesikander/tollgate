"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";
import { getAuditLog, getAgents } from "@/lib/api";
import { DecisionBadge } from "@/components/decision-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AuditEntry, Decision } from "@/lib/types";

const PAGE_SIZE = 25;

const DECISIONS: { label: string; value: string }[] = [
  { label: "All decisions", value: "all" },
  { label: "Allowed", value: "allowed" },
  { label: "Denied", value: "denied" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

function generateHourlyData(entries: AuditEntry[]) {
  const now = new Date();
  const buckets: Record<
    string,
    { hour: string; allowed: number; denied: number; pending: number }
  > = {};

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(d.getHours() - i, 0, 0, 0);
    const key = format(d, "HH:mm");
    buckets[key] = { hour: key, allowed: 0, denied: 0, pending: 0 };
  }

  entries.forEach((e) => {
    const d = new Date(e.created_at);
    d.setMinutes(0, 0, 0);
    const key = format(d, "HH:mm");
    if (buckets[key]) {
      const dec = e.decision;
      if (dec === "allowed" || dec === "approved") {
        buckets[key].allowed += 1;
      } else if (dec === "denied" || dec === "rejected") {
        buckets[key].denied += 1;
      } else if (dec === "pending") {
        buckets[key].pending += 1;
      }
    }
  });

  return Object.values(buckets);
}

export default function AuditPage() {
  const [agentFilter, setAgentFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const offset = page * PAGE_SIZE;

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit", agentFilter, decisionFilter, page],
    queryFn: async () => {
      try {
        return await getAuditLog({
          agent_id: agentFilter !== "all" ? agentFilter : undefined,
          decision: decisionFilter !== "all" ? decisionFilter : undefined,
          limit: PAGE_SIZE,
          offset,
        });
      } catch {
        return { items: [], total: 0 };
      }
    },
    placeholderData: (prev) => prev,
  });

  const { data: chartData } = useQuery({
    queryKey: ["audit-chart"],
    queryFn: async () => {
      try {
        return await getAuditLog({ limit: 200, offset: 0 });
      } catch {
        return { items: [], total: 0 };
      }
    },
    staleTime: 60_000,
  });

  const hourly = generateHourlyData(chartData?.items ?? []);
  const allItems = chartData?.items ?? [];
  const allowedCount = allItems.filter((e) => e.decision === "allowed" || e.decision === "approved").length;
  const deniedCount = allItems.filter((e) => e.decision === "denied" || e.decision === "rejected").length;
  const pendingCount = allItems.filter((e) => e.decision === "pending").length;

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function exportCsv() {
    if (!data?.items) return;
    const headers = [
      "Time (UTC)",
      "Agent",
      "Action",
      "Payload",
      "Decision",
      "Decision Source",
      "Reason",
      "Decided At",
      "Decided By",
      "Decided By User ID",
      "Approval Status",
      "Approval Requested At",
      "Approval Decided At",
      "Approval Expires At",
      "Slack Channel",
      "Approvers Config",
      "Idempotency Key",
    ];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      headers.join(","),
      ...data.items.map((e) =>
        [
          format(new Date(e.created_at), "yyyy-MM-dd HH:mm:ss"),
          e.agent_name ?? e.agent_id,
          e.action_name,
          escape(JSON.stringify(e.payload)),
          e.decision,
          e.decision_source ?? "",
          e.reason ?? "",
          e.decided_at ? format(new Date(e.decided_at), "yyyy-MM-dd HH:mm:ss") : "",
          e.decided_by ?? "",
          e.decided_by_user_id ?? "",
          e.approval_status ?? "",
          e.approval_requested_at ? format(new Date(e.approval_requested_at), "yyyy-MM-dd HH:mm:ss") : "",
          e.approval_decided_at ? format(new Date(e.approval_decided_at), "yyyy-MM-dd HH:mm:ss") : "",
          e.approval_expires_at ? format(new Date(e.approval_expires_at), "yyyy-MM-dd HH:mm:ss") : "",
          e.slack_channel ?? "",
          escape(JSON.stringify(e.approvers_config ?? {})),
          e.idempotency_key ?? "",
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tollgate-audit-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 relative"
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 30% at 50% 0%, rgba(244,83,60,0.035) 0%, transparent 65%)",
        }}
      />

      {/* Header */}
      <div className="h-16 flex items-center justify-between px-8 border-b border-border relative">
        <div>
          <h1 className="text-base font-semibold text-foreground leading-none">Audit Log</h1>
          <p className="text-xs text-muted-foreground mt-1">Full history of agent decisions</p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-colors border border-border"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="relative p-8 space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Allowed", count: allowedCount, color: "#5BD982", bg: "rgba(91,217,130,0.07)", border: "rgba(91,217,130,0.2)" },
            { label: "Denied", count: deniedCount, color: "#ef4444", bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.2)" },
            { label: "Pending", count: pendingCount, color: "#F4533C", bg: "rgba(244,83,60,0.07)", border: "rgba(244,83,60,0.2)" },
          ].map(({ label, count, color, bg, border }) => (
            <div
              key={label}
              className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                {label}
              </span>
              <span className="text-2xl font-bold tracking-tight" style={{ color }}>
                {count}
              </span>
            </div>
          ))}
        </div>

        {/* Hourly chart */}
        <div
          className="rounded-xl px-6 pt-5 pb-3"
          style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
            Activity — last 24h
          </p>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={hourly} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradAllowed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5BD982" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#5BD982" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDenied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F4533C" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F4533C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis hide />
              <RechartTooltip
                contentStyle={{
                  background: "#131313",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#ffffff",
                }}
                itemStyle={{ color: "#ffffff" }}
                cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              />
              <Area type="monotone" dataKey="allowed" stackId="1" stroke="#5BD982" fill="url(#gradAllowed)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="denied" stackId="1" stroke="#ef4444" fill="url(#gradDenied)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="pending" stackId="1" stroke="#F4533C" fill="url(#gradPending)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={agentFilter} onValueChange={(v) => { setAgentFilter(v ?? "all"); setPage(0); }}>
            <SelectTrigger className="w-52 bg-card border-border text-foreground h-9">
              <SelectValue>
                {agentFilter === "all" ? "All agents" : (agents.find((a) => a.id === agentFilter)?.name ?? agentFilter)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={decisionFilter} onValueChange={(v) => { setDecisionFilter(v ?? "all"); setPage(0); }}>
            <SelectTrigger className="w-48 bg-card border-border text-foreground h-9">
              <SelectValue>
                {DECISIONS.find((d) => d.value === decisionFilter)?.label ?? "All decisions"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              {DECISIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(agentFilter !== "all" || decisionFilter !== "all") && (
            <button
              onClick={() => { setAgentFilter("all"); setDecisionFilter("all"); setPage(0); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded bg-secondary" />
              ))}
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <FileText className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No entries found</h3>
              <p className="text-xs text-muted-foreground">
                {decisionFilter !== "all" || agentFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Actions will appear here once your agents start running"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Time", "Agent", "Action", "Decision", "Payload", "Decided By"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((entry: AuditEntry) => (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="transition-colors hover:bg-white/[0.025]"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <Tooltip>
                          <TooltipTrigger>
                            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                          </TooltipTrigger>
                          <TooltipContent className="bg-card border-border text-foreground text-xs">
                            {format(new Date(entry.created_at), "MMM d, yyyy HH:mm:ss")}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-6 py-3 text-sm text-foreground truncate max-w-[140px]">
                        {entry.agent_name ?? entry.agent_id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-muted-foreground truncate max-w-[160px]">
                        {entry.action_name}
                      </td>
                      <td className="px-6 py-3">
                        <DecisionBadge decision={entry.decision as Decision} />
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          {expandedId === entry.id ? "Hide" : "Show"}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">
                        {entry.decided_by ?? <span className="text-muted-foreground/30">—</span>}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td colSpan={6} className="px-6 pb-5 pt-2">
                          <div className="grid grid-cols-3 gap-3">

                            {/* Decision record */}
                            <div className="rounded-lg p-4 flex flex-col gap-2.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Decision Record</p>
                              {[
                                ["Action", entry.action_name],
                                ["Decision", entry.decision],
                                ["Source", entry.decision_source ?? "—"],
                                ["Reason", entry.reason ?? "—"],
                                ["Requested", entry.created_at ? format(new Date(entry.created_at), "MMM d, yyyy HH:mm:ss") : "—"],
                                ["Decided", entry.decided_at ? format(new Date(entry.decided_at), "MMM d, yyyy HH:mm:ss") : "—"],
                                ["Idempotency Key", entry.idempotency_key ?? "—"],
                              ].map(([k, v]) => (
                                <div key={k} className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">{k}</span>
                                  <span className="text-xs font-mono text-foreground/80 break-all">{v}</span>
                                </div>
                              ))}
                            </div>

                            {/* Human approval */}
                            <div className="rounded-lg p-4 flex flex-col gap-2.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Approval Details</p>
                              {[
                                ["Status", entry.approval_status ?? "no approval required"],
                                ["Approved By", entry.decided_by ?? "—"],
                                ["Approver ID", entry.decided_by_user_id ?? "—"],
                                ["Approval Requested", entry.approval_requested_at ? format(new Date(entry.approval_requested_at), "MMM d, yyyy HH:mm:ss") : "—"],
                                ["Approval Decided", entry.approval_decided_at ? format(new Date(entry.approval_decided_at), "MMM d, yyyy HH:mm:ss") : "—"],
                                ["Expires At", entry.approval_expires_at ? format(new Date(entry.approval_expires_at), "MMM d, yyyy HH:mm:ss") : "—"],
                                ["Slack Channel", entry.slack_channel ?? "—"],
                                ["Approvers Config", entry.approvers_config ? JSON.stringify(entry.approvers_config) : "—"],
                              ].map(([k, v]) => (
                                <div key={k} className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">{k}</span>
                                  <span className="text-xs font-mono text-foreground/80 break-all">{v}</span>
                                </div>
                              ))}
                            </div>

                            {/* Payload */}
                            <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Payload</p>
                              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                                {JSON.stringify(entry.payload, null, 2)}
                              </pre>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
