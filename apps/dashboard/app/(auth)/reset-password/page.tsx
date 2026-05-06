"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@tollgate/ui";
import { resetPassword } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, AlertCircle, Lock } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) toast.error("Missing reset token. Request a new link.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 8)  { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2800);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reset link is invalid or has expired");
    } finally {
      setLoading(false);
    }
  }

  /* ── Missing token ──────────────────────────────────────── */
  if (!token) {
    return (
      <div className="text-center">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}>
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">Invalid link</h1>
        <p className="text-sm text-muted-foreground mb-7 leading-relaxed">
          This reset link is missing or malformed.<br />Request a new one below.
        </p>
        <Link href="/forgot-password" className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-80 font-medium transition-opacity">
          <ArrowLeft className="w-3.5 h-3.5" />
          Request a new link
        </Link>
      </div>
    );
  }

  /* ── Done ────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="text-center">
        <style>{`
          @keyframes rp-pop { 0%{transform:scale(0.8);opacity:0;} 60%{transform:scale(1.08);} 100%{transform:scale(1);opacity:1;} }
        `}</style>
        <div className="flex justify-center mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(91,217,130,0.08)", border: "1px solid rgba(91,217,130,0.25)", animation: "rp-pop 0.5s ease forwards" }}
          >
            <CheckCircle className="w-6 h-6" style={{ color: "#5BD982" }} />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">Password updated</h1>
        <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
      </div>
    );
  }

  /* ── Form ────────────────────────────────────────────────── */
  return (
    <>
      <div className="mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
          style={{ background: "rgba(244,83,60,0.08)", border: "1px solid rgba(244,83,60,0.2)" }}
        >
          <Lock className="w-5 h-5" style={{ color: "#F4533C" }} strokeWidth={1.75} />
        </div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight mb-1.5">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Must be at least 8 characters.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            New password
          </Label>
          <Input
            id="password" type="password" autoComplete="new-password" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10"
          />
          {password.length > 0 && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex gap-1 flex-1">
                {[1,2,3,4].map((i) => (
                  <div
                    key={i}
                    className="h-0.5 flex-1 rounded-full transition-all duration-300"
                    style={{ background: password.length >= i * 2 ? (password.length >= 10 ? "#5BD982" : password.length >= 6 ? "#F4533C" : "rgba(255,255,255,0.15)") : "rgba(255,255,255,0.08)" }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {password.length < 6 ? "weak" : password.length < 10 ? "ok" : "strong"}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Confirm password
          </Label>
          <Input
            id="confirm" type="password" autoComplete="new-password" placeholder="••••••••"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-10"
          />
          {confirm.length > 0 && password.length > 0 && (
            <p className="text-[11px]" style={{ color: confirm === password ? "#5BD982" : "rgba(239,68,68,0.8)" }}>
              {confirm === password ? "✓ Passwords match" : "✗ Passwords do not match"}
            </p>
          )}
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating…</>
          ) : "Update password"}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-border text-center">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "#0a0a0a",
        backgroundImage: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(244,83,60,0.09) 0%, transparent 65%)",
      }}
    >
      {/* Dotted grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo size="lg" variant="full" />
        </div>

        <div
          className="rounded-2xl border border-border overflow-hidden"
          style={{ background: "rgba(19,19,19,0.9)", backdropFilter: "blur(12px)", boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)" }}
        >
          <div className="p-8">
            <Suspense fallback={
              <div className="h-48 flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
