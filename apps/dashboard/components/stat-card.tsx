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
    <div className="bg-card border border-border rounded-xl p-6 hover:border-white/20 transition-colors duration-200 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          {label}
        </p>
        <Icon
          className={cn(
            "w-4 h-4",
            highlight && value > 0 ? "text-primary" : "text-muted-foreground/30"
          )}
        />
      </div>
      <p
        className={cn(
          "text-4xl font-bold tracking-tight leading-none",
          highlight && value > 0 ? "text-primary" : "text-foreground"
        )}
      >
        {displayed}
      </p>
    </div>
  );
}
