"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Clock, Activity, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getStats,
  getPendingActions,
  getRecentActivity,
  decideAction,
} from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { DecisionBadge } from "@/components/decision-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditEntry, PendingAction } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 15_000,
  });

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending"],
    queryFn: getPendingActions,
    refetchInterval: 10_000,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => getRecentActivity(10),
    refetchInterval: 30_000,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      decideAction(id, decision),
    onSuccess: (_, { decision }) => {
      toast.success(decision === "approved" ? "Action approved" : "Action rejected");
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: () => toast.error("Failed to process decision"),
  });

  const hasPending = pending.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 relative"
    >
      <style>{`
        @keyframes db-pulse { 0%,100%{opacity:0.45;transform:scale(1);} 50%{opacity:1;transform:scale(1.35);} }
      `}</style>

      {/* Ambient page glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 30% at 50% 0%, rgba(244,83,60,0.035) 0%, transparent 65%)",
        }}
      />

      {/* Header */}
      <div className="h-16 flex items-center justify-between px-8 border-b border-border relative">
        <div>
          <h1 className="text-base font-semibold text-foreground leading-none">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">Overview of your agent activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"
            style={{ animation: "db-pulse 2s ease-in-out infinite" }}
          />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      <div className="relative p-8 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {statsLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl bg-card" />
              ))}
            </>
          ) : (
            <>
              <StatCard icon={Bot} label="Total Agents" value={stats?.agent_count ?? 0} />
              <StatCard icon={Clock} label="Pending Approvals" value={stats?.pending_count ?? 0} highlight />
              <StatCard icon={Activity} label="Actions Today" value={stats?.actions_today ?? 0} />
            </>
          )}
        </div>

        {/* Two-column content */}
        <div className="grid grid-cols-5 gap-4">
          {/* Recent activity — 60% */}
          <div className="col-span-3 bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
              <button
                onClick={() => router.push("/audit")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {activityLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded bg-secondary" />
                ))}
              </div>
            ) : (activity?.items.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <Activity className="w-5 h-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Actions will appear here once your agents start running
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Time", "Agent", "Action", "Decision"].map((h) => (
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
                  {activity?.items.map((entry: AuditEntry) => (
                    <tr
                      key={entry.id}
                      onClick={() => router.push("/audit")}
                      className="border-b border-border/40 last:border-0 hover:bg-white/[0.025] cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-3 text-sm text-foreground truncate max-w-[120px]">
                        {entry.agent_name ?? entry.agent_id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-muted-foreground truncate max-w-[140px]">
                        {entry.action_name}
                      </td>
                      <td className="px-6 py-3">
                        <DecisionBadge decision={entry.decision} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending approvals — 40% */}
          <div
            className="col-span-2 rounded-xl flex flex-col overflow-hidden transition-all duration-500"
            style={{
              background: "#131313",
              border: hasPending ? "1px solid rgba(244,83,60,0.28)" : "1px solid rgba(255,255,255,0.10)",
              boxShadow: hasPending ? "0 0 40px rgba(244,83,60,0.06)" : "none",
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: hasPending ? "1px solid rgba(244,83,60,0.14)" : "1px solid rgba(255,255,255,0.10)" }}
            >
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
                {hasPending && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#F4533C", animation: "db-pulse 1.5s ease-in-out infinite" }}
                  />
                )}
              </div>
              {hasPending && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {pending.length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {pendingLoading ? (
                <div className="p-6 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 rounded bg-secondary" />
                  ))}
                </div>
              ) : pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "rgba(91,217,130,0.08)", border: "1px solid rgba(91,217,130,0.2)" }}
                  >
                    <CheckCircle className="w-5 h-5" style={{ color: "#5BD982" }} />
                  </div>
                  <p className="text-sm font-medium text-foreground">All clear</p>
                  <p className="text-xs text-muted-foreground mt-1">No pending approvals</p>
                </div>
              ) : (
                <AnimatePresence>
                  <ul>
                    {pending.map((action: PendingAction) => (
                      <motion.li
                        key={action.id}
                        initial={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                        transition={{ duration: 0.25 }}
                        className="px-6 py-4"
                        style={{ borderBottom: "1px solid rgba(244,83,60,0.08)" }}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground font-mono truncate">
                              {action.action_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {action.agent_name ?? action.agent_id.slice(0, 8)}
                              {" · "}
                              {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono rounded-lg px-2.5 py-1.5 mb-3 truncate" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {JSON.stringify(action.payload).slice(0, 55)}…
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => decideMutation.mutate({ id: action.id, decision: "approved" })}
                            disabled={decideMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-50 hover:-translate-y-px"
                            style={{ background: "rgba(91,217,130,0.09)", border: "1px solid rgba(91,217,130,0.24)", color: "#5BD982" }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => decideMutation.mutate({ id: action.id, decision: "rejected" })}
                            disabled={decideMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-50 hover:-translate-y-px"
                            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
