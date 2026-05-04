"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bot,
  Plus,
  Copy,
  FileText,
  Trash2,
  MoreHorizontal,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { getAgents, createAgent, deleteAgent } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Agent, AgentWithKey } from "@/lib/types";

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState<AgentWithKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createAgent(name),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setSheetOpen(false);
      setNewName("");
      setNewKey(agent);
    },
    onError: () => toast.error("Failed to create agent"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Agent deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete agent"),
  });

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
        <h1 className="text-lg font-semibold text-[#f8fafc]">Agents</h1>
        <button
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 text-white font-medium text-sm hover:-translate-y-px transition-transform duration-150"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl bg-[#1e1e2e]" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-[#94a3b8]/60" />
            </div>
            <h2 className="text-base font-semibold text-[#f8fafc] mb-1">
              No agents yet
            </h2>
            <p className="text-sm text-[#94a3b8] mb-6 max-w-xs">
              Create your first agent to start enforcing policies on your AI
              workflows.
            </p>
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 text-white font-medium text-sm hover:-translate-y-px transition-transform duration-150"
            >
              <Plus className="w-4 h-4" />
              Create your first agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {agents.map((agent: Agent) => (
              <div
                key={agent.id}
                className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-6 hover:border-[#2e2e3e] transition-colors duration-200 flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-violet-400" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/[0.05] transition-colors"
                      render={<button />}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-[#111118] border-[#2e2e3e] text-[#f8fafc]"
                    >
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(agent)}
                        className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete agent
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-semibold text-[#f8fafc] mb-1">
                  {agent.name}
                </h3>
                <p className="text-xs font-mono text-[#94a3b8] mb-1 truncate">
                  {agent.id}
                </p>
                <p className="text-xs text-[#94a3b8] mb-4">
                  Created{" "}
                  {formatDistanceToNow(new Date(agent.created_at), {
                    addSuffix: true,
                  })}
                </p>

                <div className="mt-auto">
                  <Link
                    href={`/agents/${agent.id}/policy`}
                    className="inline-flex items-center gap-2 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Edit Policy
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New agent slide-over */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="bg-[#111118] border-[#1e1e2e] text-[#f8fafc] w-[420px]"
        >
          <SheetHeader>
            <SheetTitle className="text-[#f8fafc]">New Agent</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                Agent name
              </Label>
              <Input
                placeholder="e.g. support-bot"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    createMutation.mutate(newName.trim());
                  }
                }}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-[#f8fafc] placeholder:text-[#94a3b8]/50 h-10"
              />
            </div>
            <button
              onClick={() => createMutation.mutate(newName.trim())}
              disabled={!newName.trim() || createMutation.isPending}
              className="w-full h-10 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 text-white font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                "Create agent"
              )}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* API key reveal dialog */}
      <Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] text-[#f8fafc] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#f8fafc]">
              Agent created — save your API key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-400">
              This key will not be shown again. Copy it now and store it
              securely.
            </div>
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 flex items-center gap-3">
              <code className="text-sm text-[#f8fafc] font-mono flex-1 break-all">
                {newKey?.api_key}
              </code>
              <button
                onClick={() => newKey && copyKey(newKey.api_key)}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1e1e2e] hover:bg-[#2e2e3e] flex items-center justify-center transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-[#94a3b8]" />
                )}
              </button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="w-full h-10 rounded-lg bg-[#1e1e2e] hover:bg-[#2e2e3e] text-[#f8fafc] font-medium text-sm transition-colors"
            >
              I&apos;ve saved my key
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="bg-[#111118] border-[#1e1e2e] text-[#f8fafc] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#f8fafc]">Delete agent?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#94a3b8] mt-2">
            This will permanently delete{" "}
            <span className="text-[#f8fafc] font-medium">
              {deleteTarget?.name}
            </span>{" "}
            and all its data. This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 h-10 rounded-lg bg-[#1e1e2e] hover:bg-[#2e2e3e] text-[#f8fafc] font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
              className="flex-1 h-10 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium text-sm transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete agent"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
