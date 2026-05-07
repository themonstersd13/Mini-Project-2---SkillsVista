"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, MessageCircle, ClipboardList, BarChart3, LogOut } from "lucide-react";

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItemClass = (path: string) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === path
        ? "bg-[var(--brand)] text-white"
        : "text-black/70 hover:bg-black/5"
    }`;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="text-lg font-bold tracking-tight">
          SWOT Coach
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/dashboard" className={navItemClass("/dashboard")}>
            <LayoutDashboard size={15} />
            Dashboard
          </Link>
          <Link href="/coach" className={navItemClass("/coach")}>
            <MessageCircle size={15} />
            Chat Coach
          </Link>
          <Link href="/assessment" className={navItemClass("/assessment")}>
            <ClipboardList size={15} />
            Assessment
          </Link>
          <Link href="/reports" className={navItemClass("/reports")}>
            <BarChart3 size={15} />
            Reports
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-medium text-black/70 transition hover:bg-black/5"
          >
            <LogOut size={14} />
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
