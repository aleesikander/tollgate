"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Clock, Activity, CheckCircle, XCircle } from "lucide-react";
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
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approved" | "rejected";
    }) => decideAction(id, decision),
    onSuccess: (_, { decision }) => {
      toast.success(decision === "approved" ? "Action approved" : "Action rejected");
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: () => toast.error("Failed to process decision"),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1"
    >
      {/* Header */}
      <div className="h-16 flex items-center px-8 border-b border-[#1e1e2e]">
        <h1 className="text-lg font-semibold text-[#f8fafc]">Dashboard</h1>
      </div>

      <div className="p-8 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-5">
          {statsLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl bg-[#1e1e2e]" />
              ))}
            </>
          ) : (
            <>
              <StatCard
                icon={Bot}
                label="Total Agents"
                value={stats?.agent_count ?? 0}
              />
              <StatCard
                icon={Clock}
                label="Pending Approvals"
                value={stats?.pending_count ?? 0}
                highlight
              />
              <StatCard
                icon={Activity}
                label="Actions Today"
                value={stats?.actions_today ?? 0}
              />
            </>
          )}
        </div>

        {/* Two-column content */}
        <div className="grid grid-cols-5 gap-5">
          {/* Recent activity — 60% */}
          <div className="col-span-3 bg-[#111118] border border-[#1e1e2e] rounded-xl">
            <div className="px-6 py-4 border-b border-[#1e1e2e]">
              <h2 className="text-sm font-semibold text-[#f8fafc]">
                Recent Activity
              </h2>
            </div>
            {activityLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded bg-[#1e1e2e]" />
                ))}
              </div>
            ) : (activity?.items.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Activity className="w-10 h-10 text-[#94a3b8]/40 mb-3" />
                <p className="text-sm font-medium text-[#94a3b8]">
                  No activity yet
                </p>
                <p className="text-xs text-[#94a3b8]/60 mt-1">
                  Actions will appear here once your agents start running
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    {["Time", "Agent", "Action", "Decision"].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
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
                      className="border-b border-[#1e1e2e]/50 last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3 text-xs text-[#94a3b8] whitespace-nowrap">
                        {formatDistanceToNow(new Date(entry.created_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="px-6 py-3 text-sm text-[#f8fafc] truncate max-w-[120px]">
                        {entry.agent_name ?? entry.agent_id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-3 text-sm font-mono text-[#94a3b8] truncate max-w-[140px]">
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
          <div className="col-span-2 bg-[#111118] border border-[#1e1e2e] rounded-xl flex flex-col">
            <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#f8fafc]">
                Pending Approvals
              </h2>
              {pending.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {pending.length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {pendingLoading ? (
                <div className="p-6 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 rounded bg-[#1e1e2e]" />
                  ))}
                </div>
              ) : pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-[#f8fafc]">
                    All clear
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-1">
                    No pending approvals
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  <ul className="divide-y divide-[#1e1e2e]">
                    {pending.map((action: PendingAction) => (
                      <motion.li
                        key={action.id}
                        initial={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                        transition={{ duration: 0.25 }}
                        className="px-6 py-4"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#f8fafc] font-mono truncate">
                              {action.action_name}
                            </p>
                            <p className="text-xs text-[#94a3b8] mt-0.5 truncate">
                              {action.agent_name ?? action.agent_id.slice(0, 8)}{" "}
                              &middot;{" "}
                              {formatDistanceToNow(
                                new Date(action.created_at),
                                { addSuffix: true }
                              )}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-[#94a3b8] font-mono bg-[#0a0a0f] rounded px-2 py-1 mb-3 truncate">
                          {JSON.stringify(action.payload).slice(0, 60)}…
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              decideMutation.mutate({
                                id: action.id,
                                decision: "approved",
                              })
                            }
                            disabled={decideMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/20 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              decideMutation.mutate({
                                id: action.id,
                                decision: "rejected",
                              })
                            }
                            disabled={decideMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20 transition-colors disabled:opacity-50"
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
