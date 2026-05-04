import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";

const config: Record<
  Decision,
  { label: string; dot: string; pill: string }
> = {
  allowed: {
    label: "Allowed",
    dot: "bg-green-500",
    pill: "bg-green-500/10 text-green-400 border border-green-500/20",
  },
  denied: {
    label: "Denied",
    dot: "bg-red-500",
    pill: "bg-red-500/10 text-red-400 border border-red-500/20",
  },
  pending: {
    label: "Pending",
    dot: "bg-amber-500 animate-pulse",
    pill: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  approved: {
    label: "Approved",
    dot: "bg-blue-500",
    pill: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-slate-500",
    pill: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  },
};

export function DecisionBadge({
  decision,
  className,
}: {
  decision: Decision;
  className?: string;
}) {
  const c = config[decision] ?? config.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        c.pill,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", c.dot)} />
      {c.label}
    </span>
  );
}
