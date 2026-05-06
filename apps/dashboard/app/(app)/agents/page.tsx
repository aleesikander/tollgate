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
  Key,
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
          <h1 className="text-base font-semibold text-foreground leading-none">Agents</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {agents.length > 0
              ? `${agents.length} registered agent${agents.length !== 1 ? "s" : ""}`
              : "Manage your registered AI agents"}
          </p>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:-translate-y-px transition-transform duration-150"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      <div className="relative p-8">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl bg-card" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 relative"
              style={{ background: "rgba(244,83,60,0.07)", border: "1px solid rgba(244,83,60,0.18)" }}
            >
              <Bot className="w-7 h-7" style={{ color: "rgba(244,83,60,0.7)" }} />
              {/* Pulse rings */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{ border: "1px solid rgba(244,83,60,0.3)", animation: "ag-ring 2.5s ease-in-out infinite" }}
              />
              <style>{`
                @keyframes ag-ring { 0%{transform:scale(1);opacity:0.6;} 70%{transform:scale(1.35);opacity:0;} 100%{transform:scale(1.35);opacity:0;} }
              `}</style>
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1.5">No agents yet</h2>
            <p className="text-sm text-muted-foreground mb-7 max-w-xs leading-relaxed">
              Create your first agent to start enforcing policies on your AI workflows.
            </p>
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:-translate-y-px transition-transform duration-150"
            >
              <Plus className="w-4 h-4" />
              Create your first agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {agents.map((agent: Agent) => (
              <div
                key={agent.id}
                className="group rounded-xl p-6 flex flex-col transition-all duration-200 hover:border-white/20"
                style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(244,83,60,0.08)", border: "1px solid rgba(244,83,60,0.18)" }}
                  >
                    <Bot className="w-5 h-5" style={{ color: "#F4533C" }} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors opacity-0 group-hover:opacity-100"
                      render={<button />}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(agent)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete agent
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-semibold text-foreground mb-1 truncate">{agent.name}</h3>
                <p className="text-xs font-mono text-muted-foreground/50 mb-1 truncate">{agent.id}</p>
                <p className="text-xs text-muted-foreground mb-5">
                  Created {formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}
                </p>

                <div className="mt-auto pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Link
                    href={`/agents/${agent.id}/policy`}
                    className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
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
        <SheetContent side="right" className="bg-card border-border text-foreground w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-foreground">New Agent</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Give your agent a name. An API key will be generated for you to use with the Tollgate SDK.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                className="h-10"
              />
            </div>
            <button
              onClick={() => createMutation.mutate(newName.trim())}
              disabled={!newName.trim() || createMutation.isPending}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
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
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(244,83,60,0.1)", border: "1px solid rgba(244,83,60,0.2)" }}
              >
                <Key className="w-3.5 h-3.5" style={{ color: "#F4533C" }} />
              </div>
              Save your API key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", color: "rgba(245,158,11,0.9)" }}
            >
              This key will not be shown again. Copy it now and store it securely.
            </div>
            <div
              className="rounded-lg px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <code className="text-sm text-foreground font-mono flex-1 break-all">
                {newKey?.api_key}
              </code>
              <button
                onClick={() => newKey && copyKey(newKey.api_key)}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="w-full h-10 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-colors"
            >
              I&apos;ve saved my key
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete agent?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            This will permanently delete{" "}
            <span className="text-foreground font-medium">{deleteTarget?.name}</span>{" "}
            and all its data. This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 h-10 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="flex-1 h-10 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)", color: "#ef4444" }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete agent"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
