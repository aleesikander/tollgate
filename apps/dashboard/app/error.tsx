"use client";

import { useEffect } from "react";
import { Logo } from "@tollgate/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at top, rgba(244,83,60,0.08) 0%, #0a0a0a 60%)",
      }}
    >
      <div className="w-full max-w-[400px] px-4 text-center">
        <div className="flex items-center justify-center mb-10">
          <Logo size="lg" variant="full" />
        </div>

        <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>

        <h1 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-8">
          An unexpected error occurred. Try refreshing — if it keeps happening, the API may be unreachable.
        </p>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:-translate-y-px transition-transform duration-150"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}
