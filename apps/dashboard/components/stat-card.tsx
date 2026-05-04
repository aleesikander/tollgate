"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function useCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  highlight?: boolean;
}

export function StatCard({ icon: Icon, label, value, highlight }: StatCardProps) {
  const displayed = useCounter(value);

  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-6 flex items-center gap-4 hover:border-[#2e2e3e] transition-colors duration-200">
      <div className="w-12 h-12 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-violet-400" />
      </div>
      <div>
        <p
          className={cn(
            "text-3xl font-bold",
            highlight && value > 0 ? "text-amber-400" : "text-[#f8fafc]"
          )}
        >
          {displayed}
        </p>
        <p className="text-xs font-medium tracking-wide uppercase text-[#94a3b8] mt-0.5">
          {label}
        </p>
      </div>
    </div>
  );
}
