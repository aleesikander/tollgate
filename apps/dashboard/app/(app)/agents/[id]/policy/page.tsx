"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Save,
  AlertCircle,
  ChevronLeft,
  Bot,
  FileText,
  ArrowRight,
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
    <div className="flex-1 bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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

const DECISION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  allow: {
    label: "allow",
    color: "#5BD982",
    bg: "rgba(91,217,130,0.08)",
    border: "rgba(91,217,130,0.22)",
  },
  deny: {
    label: "deny",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
  },
  require_approval: {
    label: "requires approval",
    color: "#F4533C",
    bg: "rgba(244,83,60,0.08)",
    border: "rgba(244,83,60,0.22)",
  },
};

function RuleCard({ rule, index }: { rule: ParsedRule; index: number }) {
  const cfg = DECISION_CONFIG[rule.decision] ?? {
    label: rule.decision,
    color: "rgba(255,255,255,0.5)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.1)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.06 }}
      className="rounded-xl p-4"
      style={{ background: "#131313", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <code className="text-sm font-mono text-foreground">{rule.action}</code>
        <span
          className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
          {cfg.label}
        </span>
      </div>

      {rule.condition ? (
        <div
          className="text-xs font-mono text-muted-foreground rounded-md px-2.5 py-1.5 mb-2"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-muted-foreground/50">when </span>
          {rule.condition}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/40 mb-2 italic">always</p>
      )}

      {rule.approvers && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
          <ArrowRight className="w-3 h-3 flex-shrink-0" />
          {rule.approvers}
        </div>
      )}
    </motion.div>
  );
}

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

  const isValid = !parseError && rules.length > 0;

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
          background: "radial-gradient(ellipse 70% 25% at 50% 0%, rgba(244,83,60,0.03) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <div className="h-16 flex items-center gap-2.5 px-8 border-b border-border flex-shrink-0 relative">
        <button
          onClick={() => router.push("/agents")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Agents
        </button>
        <span className="text-muted-foreground/25">/</span>
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(244,83,60,0.1)", border: "1px solid rgba(244,83,60,0.2)" }}
          >
            <Bot className="w-3 h-3" style={{ color: "#F4533C" }} />
          </div>
          <span className="text-sm font-semibold text-foreground">{agentName}</span>
        </div>
        <span className="text-muted-foreground/25">/</span>
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Policy
        </span>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left: Monaco editor */}
        <div className="w-1/2 flex flex-col border-r border-border">
          {/* Editor label bar */}
          <div
            className="h-9 flex items-center justify-between px-5 border-b border-border flex-shrink-0"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              policy.yaml
            </span>
            <AnimatePresence mode="wait">
              {parseError ? (
                <motion.span
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-[10px] text-destructive"
                >
                  <AlertCircle className="w-3 h-3" />
                  syntax error
                </motion.span>
              ) : isValid ? (
                <motion.span
                  key="valid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: "#5BD982" }}
                >
                  <CheckCircle className="w-3 h-3" />
                  valid · {rules.length} rule{rules.length !== 1 ? "s" : ""}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          {isLoading ? (
            <div className="flex-1 bg-background flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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

        {/* Right: live preview */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Preview label bar */}
          <div
            className="h-9 flex items-center justify-between px-5 border-b border-border flex-shrink-0"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Live Preview
            </span>
            {isValid && (
              <span className="text-[10px] text-muted-foreground">
                {rules.length} rule{rules.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {parseError ? (
              <div
                className="rounded-xl px-4 py-4 flex gap-3"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}
              >
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Invalid YAML</p>
                  <p className="text-xs text-destructive/70 mt-1 font-mono break-all leading-relaxed">
                    {parseError}
                  </p>
                </div>
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <FileText className="w-5 h-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground">No rules yet</p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  Add rules to your YAML policy on the left
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {rules.map((rule, i) => (
                  <RuleCard key={i} rule={rule} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom save bar */}
      <div
        className="h-14 flex items-center justify-between px-8 border-t border-border flex-shrink-0 relative"
        style={{ background: "#131313" }}
      >
        <p className="text-xs text-muted-foreground">
          {savedAt
            ? `Saved ${formatDistanceToNow(savedAt, { addSuffix: true })}`
            : "Unsaved changes"}
        </p>
        <button
          onClick={() => saveMutation.mutate(currentYaml)}
          disabled={saveMutation.isPending || !!parseError}
          className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
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
