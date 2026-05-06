"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/audit", label: "Audit Log", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 300_000,
  });

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-full fixed left-0 top-0 bottom-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <Link href="/dashboard" aria-label="Tollgate home">
          <Logo size="md" variant="full" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              )}
              style={
                active
                  ? {
                      background: "rgba(244,83,60,0.08)",
                      borderLeft: "2px solid #F4533C",
                      paddingLeft: "10px",
                    }
                  : undefined
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: workspace pill + logout */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 space-y-1">
        {me && (
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
              style={{ background: "rgba(244,83,60,0.12)", border: "1px solid rgba(244,83,60,0.2)", color: "#F4533C" }}
            >
              {(me.org_name ?? me.email ?? "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate leading-tight">
                {me.org_name ?? me.email}
              </p>
              <p className="text-[10px] text-muted-foreground/60 truncate leading-tight mt-0.5">
                {me.email}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-150 w-full"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  );
}
