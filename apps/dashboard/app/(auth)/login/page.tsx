"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { login } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuth();
  const router = useRouter();

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
    <div
      className="min-h-screen flex items-center justify-center bg-[#0a0a0f]"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(124,58,237,0.12) 0%, #0a0a0f 60%)",
      }}
    >
      <div className="w-full max-w-[400px] px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-violet-400" />
          </div>
          <span className="font-bold text-[#f8fafc] text-xl tracking-tight">
            tollgate
          </span>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-[#f8fafc] mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-[#94a3b8] mb-6">
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#0a0a0f] border-[#1e1e2e] text-[#f8fafc] placeholder:text-[#94a3b8]/50 focus:ring-violet-500/50 focus:border-violet-500/50 h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#0a0a0f] border-[#1e1e2e] text-[#f8fafc] placeholder:text-[#94a3b8]/50 focus:ring-violet-500/50 focus:border-violet-500/50 h-10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 text-white font-medium text-sm hover:-translate-y-px transition-transform duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="text-sm text-[#94a3b8] text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
