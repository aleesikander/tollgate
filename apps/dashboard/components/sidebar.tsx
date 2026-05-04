"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DoorOpen,
  LayoutDashboard,
  Bot,
  FileText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/audit", label: "Audit Log", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-[#111118] border-r border-[#1e1e2e] flex flex-col h-full fixed left-0 top-0 bottom-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[#1e1e2e]">
        <DoorOpen className="w-5 h-5 text-violet-400 mr-2.5 flex-shrink-0" />
        <span className="font-bold text-[#f8fafc] text-lg tracking-tight">
          tollgate
        </span>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-violet-500/10 text-violet-300 border-l-2 border-violet-500 pl-[10px]"
                  : "text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/[0.04]"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-[#1e1e2e] pt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#94a3b8] hover:text-red-400 hover:bg-red-500/5 transition-all duration-150 w-full"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  );
}
