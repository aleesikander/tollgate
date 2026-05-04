"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Save,
  AlertCircle,
  ChevronLeft,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import yaml from "js-yaml";
import { getActivePolicy, savePolicy, getAgents, generatePolicy } from "@/lib/api";

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
  const [editorFading, setEditorFading] = useState(false);

  // AI bar state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [observedActions, setObservedActions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

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

  // Auto-open AI bar when there's no real policy saved yet
  useEffect(() => {
    if (initialYaml === DEFAULT_YAML && !aiOpen) setAiOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialYaml]);

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

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await generatePolicy(
        agentId,
        aiPrompt,
        editorValue ?? initialYaml ?? undefined
      );
      setObservedActions(res.observed_actions);
      // Fade the editor out, swap content, fade back in
      setEditorFading(true);
      await new Promise((r) => setTimeout(r, 200));
      setEditorValue(res.yaml);
      setEditorFading(false);
      toast.success("Policy generated — review and save when ready");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

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

        {/* AI toggle */}
        <button
          onClick={() => setAiOpen((v) => !v)}
          className={`ml-auto inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium border transition-all duration-150 ${
            aiOpen
              ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
              : "bg-[#1e1e2e] border-[#2e2e3e] text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#3e3e4e]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate with AI
          {aiOpen ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* AI bar */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex-shrink-0"
          >
            <div className="bg-[#0d0d15] border-b border-[#1e1e2e] px-8 py-4">
              {/* Context pill */}
              {observedActions.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-[#94a3b8]">
                    Using observed actions:
                  </span>
                  {observedActions.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-xs font-mono text-violet-300"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    placeholder='e.g. "Block account deletions, require approval for refunds over $500, allow everything else"'
                    className="w-full h-10 bg-[#111118] border border-[#1e1e2e] rounded-lg px-4 text-sm text-[#f8fafc] placeholder:text-[#94a3b8]/50 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!aiPrompt.trim() || generating}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 text-white font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex-shrink-0"
                >
                  {generating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-[#94a3b8]/60 mt-2">
                Describe your security rules in plain English. The AI will generate valid YAML using your agent&apos;s exact action names.
                {currentYaml !== DEFAULT_YAML &&
                  " Your current policy will be used as context — you can also ask to refine it."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-panel editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Monaco editor */}
        <div className="w-1/2 flex flex-col border-r border-[#1e1e2e]">
          <motion.div
            animate={{ opacity: editorFading ? 0.3 : 1 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col"
          >
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
          </motion.div>
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
              <Sparkles className="w-8 h-8 text-[#94a3b8]/30 mb-3" />
              <p className="text-sm text-[#94a3b8] mb-1">No rules yet</p>
              <p className="text-xs text-[#94a3b8]/60">
                Use the AI generator above or write YAML directly
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
