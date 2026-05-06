"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { login } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Bell, BarChart2 } from "lucide-react";

/* ── Left panel data ─────────────────────────────────────────── */

const FEATURES = [
  { Icon: ShieldCheck, text: "Policy enforcement in < 50ms" },
  { Icon: Bell,        text: "Human approval for sensitive actions" },
  { Icon: BarChart2,   text: "Full audit trail on every action" },
];

const ACTIONS = [
  { name: "issue_refund",   detail: "$30 · cus_001",     decision: "allowed" },
  { name: "send_email",     detail: "alice@corp.com",     decision: "allowed" },
  { name: "issue_refund",   detail: "$250 · cus_002",    decision: "pending" },
  { name: "delete_account", detail: "cus_003",            decision: "denied"  },
  { name: "export_data",    detail: "Q1-2025.csv",        decision: "allowed" },
  { name: "issue_refund",   detail: "$800 · cus_005",    decision: "pending" },
  { name: "cancel_order",   detail: "ord_789",            decision: "allowed" },
];

interface FeedItem { id: number; name: string; detail: string; decision: string; fresh: boolean }

function badgeStyle(d: string) {
  if (d === "allowed") return { label: "✓ allowed", color: "#5BD982", bg: "rgba(91,217,130,0.08)",  border: "rgba(91,217,130,0.22)" };
  if (d === "pending") return { label: "⏳ pending", color: "#F4533C", bg: "rgba(244,83,60,0.08)",  border: "rgba(244,83,60,0.25)" };
  return                      { label: "✗ denied",  color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.22)" };
}

let _id = 0;

function LeftPanel() {
  const [items, setItems] = useState<FeedItem[]>(() =>
    ACTIONS.slice(0, 4).map((a) => ({ ...a, id: _id++, fresh: false }))
  );
  const seq = useRef(4);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => {
      const a = ACTIONS[seq.current % ACTIONS.length];
      seq.current++;
      const nid = _id++;
      setItems((p) => [{ ...a, id: nid, fresh: true }, ...p.slice(0, 3)]);
      setTimeout(() => setItems((p) => p.map((it) => it.id === nid ? { ...it, fresh: false } : it)), 40);
      timer.current = setTimeout(tick, 2800);
    };
    timer.current = setTimeout(tick, 3000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  return (
    <div
      className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
      style={{ background: "#080808", borderRight: "1px solid rgba(255,255,255,0.05)" }}
    >
      <style>{`
        @keyframes lp-up   { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
        @keyframes lp-dot  { 0%,100%{opacity:.3;transform:scale(1);} 50%{opacity:1;transform:scale(1.5);} }
      `}</style>

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 70% 55% at 15% 60%, rgba(244,83,60,0.08) 0%, transparent 62%)",
      }} />

      {/* Logo */}
      <div className="relative">
        <a href={process.env.NEXT_PUBLIC_LANDING_URL ?? "https://www.usetollgate.com"} aria-label="Tollgate home">
          <Logo size="md" variant="full" />
        </a>
      </div>

      {/* Main content */}
      <div className="relative space-y-8">
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.028em", lineHeight: 1.12, color: "#fff", marginBottom: 10 }}>
            Agents work.<br />
            <span style={{ color: "#F4533C" }}>You decide.</span>
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, maxWidth: 265 }}>
            The policy and approval layer keeping your AI agents safe in production.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURES.map(({ Icon, text }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={13} strokeWidth={1.75} style={{ color: "rgba(255,255,255,0.35)" }} />
              </div>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Live activity feed */}
        <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.018)", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)" }}>
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
              Agent activity
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5BD982", display: "inline-block", animation: "lp-dot 1.4s ease-in-out infinite" }} />
              <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.25)" }}>live</span>
            </div>
          </div>

          {/* Rows */}
          <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
            {items.map((item) => {
              const b = badgeStyle(item.decision);
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.045)",
                    animation: item.fresh ? "lp-up 0.32s ease forwards" : "none",
                    opacity: item.fresh ? 0 : 1,
                  }}
                >
                  <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 5, color: b.color, background: b.bg, border: `1px solid ${b.border}`, minWidth: 66, textAlign: "center", flexShrink: 0, letterSpacing: "0.01em" }}>
                    {b.label}
                  </span>
                  <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.58)", fontWeight: 500, flexShrink: 0 }}>{item.name}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.detail}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="relative" style={{ fontSize: 11, color: "rgba(255,255,255,0.16)" }}>
        Protecting agent actions since 2025.
      </p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const res = await login(email, password);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
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
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1.5">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your Tollgate workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Password
                </Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password" type="password" autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
              ) : "Sign in"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:opacity-80 font-medium transition-opacity">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
