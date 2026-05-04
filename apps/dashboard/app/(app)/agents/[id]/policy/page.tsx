"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Save,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import yaml from "js-yaml";
import { getActivePolicy, savePolicy, getAgents } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const DEFAULT_YAML = `version: 1
rules:
  - action: issue_refund
    when:
      amount: { lte: 100 }
    decide: allow
  - action: issue_refund
    when:
      amount: { gt: 100 }
    decide: require_approval
    approvers: ["#approvals"]
  - action: delete_account
    decide: deny
    reason: "Not permitted via agent"
default: allow
`;

interface ParsedRule {
  action: string;
  condition?: string;
  decision: string;
  approvers?: string;
}

function parsePolicy(src: string): { rules: ParsedRule[]; error?: string } {
  try {
    const parsed = yaml.load(src) as {
      rules?: Array<{
        action: string;
        when?: Record<string, unknown>;
        decide: string;
        approvers?: string[];
      }>;
    };
    if (!parsed || typeof parsed !== "object") {
      return { rules: [], error: "Invalid YAML structure" };
    }
    const rules: ParsedRule[] = (parsed.rules ?? []).map((r) => ({
      action: r.action ?? "",
      condition: r.when ? JSON.stringify(r.when) : undefined,
      decision: r.decide ?? "",
      approvers: r.approvers?.join(", "),
    }));
    return { rules };
  } catch (e: unknown) {
    return { rules: [], error: String(e) };
  }
}

const decisionColors: Record<string, string> = {
  allow: "text-green-400 bg-green-500/10 border-green-500/20",
  deny: "text-red-400 bg-red-500/10 border-red-500/20",
  require_approval: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export default function PolicyPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editorValue, setEditorValue] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
  });

  const agentName = agents?.find((a) => a.id === agentId)?.name ?? agentId;

  const { data: initialYaml, isLoading } = useQuery<
    ReturnType<typeof getActivePolicy> extends Promise<infer T> ? T : never,
    Error,
    string
  >({
    queryKey: ["policy", agentId],
    queryFn: () => getActivePolicy(agentId),
    enabled: !!agentId,
    select: (policy): string => (policy as { source_yaml?: string } | null)?.source_yaml ?? DEFAULT_YAML,
  });

  const currentYaml = editorValue ?? initialYaml ?? DEFAULT_YAML;
  const { rules, error: parseError } = parsePolicy(currentYaml);

  const saveMutation = useMutation({
    mutationFn: (src: string) => savePolicy(agentId, src),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy", agentId] });
      setSavedAt(new Date());
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2500);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to save policy"),
  });

  const handleEditorChange = useCallback((value: string | undefined) => {
    setEditorValue(value ?? "");
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <div className="h-16 flex items-center gap-3 px-8 border-b border-[#1e1e2e] flex-shrink-0">
        <button
          onClick={() => router.push("/agents")}
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Agents
        </button>
        <span className="text-[#1e1e2e]">/</span>
        <h1 className="text-lg font-semibold text-[#f8fafc]">{agentName}</h1>
        <span className="text-[#1e1e2e]">/</span>
        <span className="text-sm text-[#94a3b8]">Policy</span>
      </div>

      {/* Two-panel editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Monaco editor */}
        <div className="w-1/2 flex flex-col border-r border-[#1e1e2e]">
          <div className="flex-1 flex flex-col">
            {isLoading ? (
              <div className="flex-1 bg-[#0a0a0f] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language="yaml"
                theme="vs-dark"
                value={currentYaml}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineHeight: 22,
                  fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
                  padding: { top: 20, bottom: 20 },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                }}
              />
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="w-1/2 flex flex-col bg-[#0a0a0f] overflow-y-auto">
          <div className="px-6 py-4 border-b border-[#1e1e2e] flex-shrink-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              Live Preview
            </p>
          </div>

          {parseError ? (
            <div className="m-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-4 flex gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Invalid YAML</p>
                <p className="text-xs text-red-400/80 mt-1 font-mono break-all">
                  {parseError}
                </p>
              </div>
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-center px-6">
              <p className="text-sm text-[#94a3b8] mb-1">No rules yet</p>
              <p className="text-xs text-[#94a3b8]/60">
                Write YAML policy rules on the left
              </p>
            </div>
          ) : (
            <div className="p-6">
              <table className="w-full border border-[#1e1e2e] rounded-xl overflow-hidden text-sm">
                <thead>
                  <tr className="bg-[#111118] border-b border-[#1e1e2e]">
                    {["Action", "Condition", "Decision"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#1e1e2e]/50 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-mono text-[#f8fafc]">
                        {rule.action}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">
                        {rule.condition ?? (
                          <span className="text-[#94a3b8]/40 not-italic">
                            always
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${decisionColors[rule.decision] ?? "text-[#94a3b8] bg-white/5 border-white/10"}`}
                        >
                          {rule.decision}
                        </span>
                        {rule.approvers && (
                          <span className="ml-2 text-xs text-[#94a3b8]">
                            → {rule.approvers}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="h-14 flex items-center justify-between px-8 border-t border-[#1e1e2e] bg-[#111118] flex-shrink-0">
        <p className="text-xs text-[#94a3b8]">
          {savedAt
            ? `Last saved ${formatDistanceToNow(savedAt, { addSuffix: true })}`
            : "Unsaved changes"}
        </p>
        <button
          onClick={() => saveMutation.mutate(currentYaml)}
          disabled={saveMutation.isPending || !!parseError}
          className="inline-flex items-center gap-2 h-8 px-4 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 text-white font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          {saveMutation.isPending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : showSaved ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              Save Policy
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
