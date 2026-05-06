import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
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

        <p className="text-[80px] font-bold leading-none text-foreground/10 tabular-nums mb-4">
          404
        </p>
        <h1 className="text-xl font-semibold text-foreground mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-8">
          This page doesn&apos;t exist or you don&apos;t have permission to view it.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-80 font-medium transition-opacity"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
