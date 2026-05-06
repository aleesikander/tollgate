"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { forgotPassword } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          {sent ? (
            /* ── Success state ─────────────────────────── */
            <div className="p-8 text-center">
              {/* Animated envelope */}
              <div className="flex justify-center mb-6">
                <div
                  className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(91,217,130,0.08)", border: "1px solid rgba(91,217,130,0.22)" }}
                >
                  <Mail className="w-7 h-7" style={{ color: "#5BD982" }} strokeWidth={1.5} />
                  {/* Pulse ring */}
                  <div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      border: "1px solid rgba(91,217,130,0.4)",
                      animation: "fp-ping 2s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>

              <style>{`
                @keyframes fp-ping {
                  0%   { transform: scale(1);    opacity: 0.7; }
                  70%  { transform: scale(1.25); opacity: 0; }
                  100% { transform: scale(1.25); opacity: 0; }
                }
              `}</style>

              <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">Check your inbox</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-1">
                We&apos;ve sent a reset link to
              </p>
              <p className="text-sm font-medium text-foreground mb-5">{email}</p>
              <p className="text-xs text-muted-foreground mb-7" style={{ opacity: 0.6 }}>
                The link expires in 15 minutes. Check your spam folder if it doesn&apos;t arrive.
              </p>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-80 font-medium transition-opacity"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ────────────────────────────── */
            <div className="p-8">
              {/* Icon */}
              <div className="mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "rgba(244,83,60,0.08)", border: "1px solid rgba(244,83,60,0.2)" }}
                >
                  <Mail className="w-5 h-5" style={{ color: "#F4533C" }} strokeWidth={1.75} />
                </div>
                <h1 className="text-xl font-semibold text-foreground tracking-tight mb-1.5">Reset your password</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter your email address and we&apos;ll send you a secure reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Email address
                  </Label>
                  <Input
                    id="email" type="email" autoComplete="email" placeholder="you@company.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10"
                  />
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                  ) : "Send reset link"}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-border text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
