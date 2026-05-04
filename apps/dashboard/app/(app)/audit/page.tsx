"use client";

import { useState } from "react";
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", agentFilter, decisionFilter, page],
    queryFn: () =>
      getAuditLog({
        agent_id: agentFilter !== "all" ? agentFilter : undefined,
        decision: decisionFilter !== "all" ? decisionFilter : undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: (prev) => prev,
  });

  // Fetch all for chart (no pagination) — only first 200 entries
  const { data: chartData } = useQuery({
    queryKey: ["audit-chart"],
    queryFn: () => getAuditLog({ limit: 200, offset: 0 }),
    staleTime: 60_000,
  });

  const hourly = generateHourlyData(chartData?.items ?? []);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function exportCsv() {
    if (!data?.items) return;
    const rows = [
      ["Time", "Agent", "Action", "Decision", "Decided By"].join(","),
      ...data.items.map((e) =>
        [
          format(new Date(e.created_at), "yyyy-MM-dd HH:mm:ss"),
          e.agent_name ?? e.agent_id,
          e.action_name,
          e.decision,
          e.decided_by ?? "",
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
      className="flex-1"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-8 border-b border-[#1e1e2e]">
        <h1 className="text-lg font-semibold text-[#f8fafc]">Audit Log</h1>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1e1e2e] hover:bg-[#2e2e3e] text-[#f8fafc] font-medium text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="p-8 space-y-6">
        {/* Hourly chart */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl px-6 pt-4 pb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[#94a3b8] mb-3">
            Activity — last 24h
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={hourly} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradAllowed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDenied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis hide />
              <RechartTooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid #1e1e2e",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#f8fafc",
                }}
                itemStyle={{ color: "#f8fafc" }}
                cursor={{ stroke: "#2e2e3e" }}
              />
              <Area
                type="monotone"
                dataKey="allowed"
                stackId="1"
                stroke="#22c55e"
                fill="url(#gradAllowed)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="denied"
                stackId="1"
                stroke="#ef4444"
                fill="url(#gradDenied)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="pending"
                stackId="1"
                stroke="#f59e0b"
                fill="url(#gradPending)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={agentFilter} onValueChange={(v) => { setAgentFilter(v ?? "all"); setPage(0); }}>
            <SelectTrigger className="w-52 bg-[#111118] border-[#1e1e2e] text-[#f8fafc] h-9">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-[#1e1e2e] text-[#f8fafc]">
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={decisionFilter} onValueChange={(v) => { setDecisionFilter(v ?? "all"); setPage(0); }}>
            <SelectTrigger className="w-48 bg-[#111118] border-[#1e1e2e] text-[#f8fafc] h-9">
              <SelectValue placeholder="All decisions" />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-[#1e1e2e] text-[#f8fafc]">
              {DECISIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded bg-[#1e1e2e]" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-red-400">Failed to load audit log</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-xs text-violet-400 hover:text-violet-300"
              >
                Retry
              </button>
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-[#94a3b8]/40" />
              </div>
              <h3 className="text-sm font-medium text-[#f8fafc] mb-1">
                No entries found
              </h3>
              <p className="text-xs text-[#94a3b8]">
                {decisionFilter !== "all" || agentFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Actions will appear here once your agents start running"}
              </p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    {["Time", "Agent", "Action", "Decision", "Payload", "Decided By"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((entry: AuditEntry) => (
                    <>
                      <tr
                        key={entry.id}
                        className="border-b border-[#1e1e2e]/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-3 text-xs text-[#94a3b8] whitespace-nowrap">
                          <Tooltip>
                            <TooltipTrigger>
                              {formatDistanceToNow(new Date(entry.created_at), {
                                addSuffix: true,
                              })}
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111118] border-[#2e2e3e] text-[#f8fafc] text-xs">
                              {format(
                                new Date(entry.created_at),
                                "MMM d, yyyy HH:mm:ss"
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-6 py-3 text-sm text-[#f8fafc] truncate max-w-[140px]">
                          {entry.agent_name ?? entry.agent_id.slice(0, 8)}
                        </td>
                        <td className="px-6 py-3 text-sm font-mono text-[#94a3b8] truncate max-w-[160px]">
                          {entry.action_name}
                        </td>
                        <td className="px-6 py-3">
                          <DecisionBadge decision={entry.decision as Decision} />
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() =>
                              setExpandedId(
                                expandedId === entry.id ? null : entry.id
                              )
                            }
                            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            {expandedId === entry.id ? "Hide" : "Show"}
                          </button>
                        </td>
                        <td className="px-6 py-3 text-xs text-[#94a3b8]">
                          {entry.decided_by ?? (
                            <span className="text-[#94a3b8]/40">—</span>
                          )}
                        </td>
                      </tr>
                      {expandedId === entry.id && (
                        <tr key={`${entry.id}-exp`} className="border-b border-[#1e1e2e]/50">
                          <td colSpan={6} className="px-6 pb-4">
                            <pre className="text-xs font-mono text-[#94a3b8] bg-[#0a0a0f] rounded-lg p-4 overflow-x-auto">
                              {JSON.stringify(entry.payload, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#94a3b8]">
              Showing {offset + 1}–
              {Math.min(offset + PAGE_SIZE, total)} of {total} results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-8 h-8 rounded-lg bg-[#111118] border border-[#1e1e2e] flex items-center justify-center text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#2e2e3e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-[#94a3b8] px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-8 h-8 rounded-lg bg-[#111118] border border-[#1e1e2e] flex items-center justify-center text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#2e2e3e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
