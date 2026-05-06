"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signup } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/* ── Left panel: cycling decision demo ───────────────────────── */

const DECISIONS = [
  {
    label: "✓ allow",
    color: "#5BD982",
    bg: "rgba(91,217,130,0.08)",
    border: "rgba(91,217,130,0.25)",
    action: "issue_refund",
    detail: "amount: $30",
    rule: "amount ≤ $50 → allow",
    latency: "0.8ms",
  },
  {
    label: "⏳ pending",
    color: "#F4533C",
    bg: "rgba(244,83,60,0.08)",
    border: "rgba(244,83,60,0.28)",
    action: "issue_refund",
    detail: "amount: $250",
    rule: "amount ≤ $500 → approval",
    latency: "0.9ms",
  },
  {
    label: "✗ deny",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    action: "delete_account",
    detail: "id: cus_003",
    rule: "always → deny",
    latency: "0.6ms",
  },
];

function LeftPanel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((n) => (n + 1) % DECISIONS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
      style={{ background: "#080808", borderRight: "1px solid rgba(255,255,255,0.05)" }}
    >
      <style>{`
        @keyframes sp-dot  { 0%,100%{opacity:.3;transform:scale(1);} 50%{opacity:1;transform:scale(1.5);} }
        @keyframes sp-in   { from{opacity:0;transform:scale(0.96);} to{opacity:1;transform:scale(1);} }
      `}</style>

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 65% 50% at 80% 35%, rgba(244,83,60,0.07) 0%, transparent 60%)",
      }} />

      {/* Logo */}
      <div className="relative">
        <a href={process.env.NEXT_PUBLIC_LANDING_URL ?? "https://www.usetollgate.com"} aria-label="Tollgate home">
          <Logo size="md" variant="full" />
        </a>
      </div>

      {/* Main content */}
      <div className="relative space-y-9">
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.028em", lineHeight: 1.12, color: "#fff", marginBottom: 10 }}>
            Ship agents<br />
            <span style={{ color: "#F4533C" }}>confidently.</span>
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, maxWidth: 270 }}>
            Write a policy. Every agent action gets evaluated instantly — allow, hold for approval, or deny.
          </p>
        </div>

        {/* Policy snippet */}
        <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.018)", padding: "12px 14px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
          <p style={{ color: "rgba(255,255,255,0.28)", marginBottom: 4, fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>policy.yaml</p>
          <p><span style={{ color: "#FFB5A8" }}>rules</span><span style={{ color: "rgba(255,255,255,0.22)" }}>:</span></p>
          <p style={{ paddingLeft: 8 }}><span style={{ color: "rgba(255,255,255,0.22)" }}>- </span><span style={{ color: "#FFB5A8" }}>action</span><span style={{ color: "rgba(255,255,255,0.22)" }}>:</span><span style={{ color: "rgba(255,255,255,0.55)" }}> issue_refund</span></p>
          <p style={{ paddingLeft: 16 }}><span style={{ color: "#FFB5A8" }}>when</span><span style={{ color: "rgba(255,255,255,0.22)" }}>:</span><span style={{ color: "rgba(255,255,255,0.55)" }}> amount ≤ 50</span></p>
          <p style={{ paddingLeft: 16 }}><span style={{ color: "#FFB5A8" }}>decide</span><span style={{ color: "rgba(255,255,255,0.22)" }}>:</span><span style={{ color: "#5BD982" }}> allow</span></p>
          <p style={{ paddingLeft: 8, marginTop: 4 }}><span style={{ color: "rgba(255,255,255,0.22)" }}>- </span><span style={{ color: "#FFB5A8" }}>action</span><span style={{ color: "rgba(255,255,255,0.22)" }}>:</span><span style={{ color: "rgba(255,255,255,0.55)" }}> issue_refund</span></p>
          <p style={{ paddingLeft: 16 }}><span style={{ color: "#FFB5A8" }}>when</span><span style={{ color: "rgba(255,255,255,0.22)" }}>:</span><span style={{ color: "rgba(255,255,255,0.55)" }}> amount ≤ 500</span></p>
          <p style={{ paddingLeft: 16 }}><span style={{ color: "#FFB5A8" }}>decide</span><span style={{ color: "rgba(255,255,255,0.22)" }}>:</span><span style={{ color: "#F4533C" }}> require_approval</span></p>
        </div>

        {/* Cycling decision cards */}
        <div>
          <p style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
            Live decisions
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {DECISIONS.map((d, i) => {
              const isActive = i === active;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: "11px 10px",
                    border: `1px solid ${isActive ? d.border : "rgba(255,255,255,0.06)"}`,
                    background: isActive ? d.bg : "rgba(255,255,255,0.018)",
                    boxShadow: isActive ? `0 0 20px ${d.color}18` : "none",
                    transition: "all 0.45s ease",
                    opacity: isActive ? 1 : 0.4,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: d.color, marginBottom: 7, letterSpacing: "0.01em" }}>{d.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500, marginBottom: 2 }}>{d.action}</div>
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", marginBottom: 6 }}>{d.detail}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 5, marginTop: 2 }}>
                    {d.latency}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="relative" style={{ display: "flex", gap: 24 }}>
        {[["< 50ms", "median latency"], ["100%", "audit coverage"], ["0", "code changes"]].map(([val, label]) => (
          <div key={label}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>{val}</p>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signup(email, password, orgName);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <LeftPanel />

      {/* Right: form */}
      <div className="flex items-center justify-center p-8" style={{ background: "#0a0a0a" }}>
        <div className="w-full max-w-[380px]">
          {/* Mobile-only logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Logo size="lg" variant="full" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1.5">Create an account</h1>
            <p className="text-sm text-muted-foreground">Set up your Tollgate workspace in seconds</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Organization name
              </Label>
              <Input
                id="org" type="text" placeholder="Acme Corp"
                value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input
                id="email" type="email" autoComplete="email" placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Password
              </Label>
              <Input
                id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters"
                value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10"
              />
              {password.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-0.5 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background: password.length >= i * 2
                            ? password.length >= 10 ? "#5BD982" : password.length >= 6 ? "#F4533C" : "rgba(255,255,255,0.15)"
                            : "rgba(255,255,255,0.08)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {password.length < 6 ? "weak" : password.length < 10 ? "ok" : "strong"}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account…</>
              ) : "Create account"}
            </button>
          </form>

          <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed" style={{ opacity: 0.6 }}>
            By creating an account you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">Privacy Policy</Link>.
          </p>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:opacity-80 font-medium transition-opacity">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
