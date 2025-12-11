"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, loadSession } from "@/lib/session";

export default function HubLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const session = loadSession();
    if (!session || !session.name) {
      router.replace("/");
      return;
    }
    setName(session.name);
  }, [router]);

  function isActive(path: string) {
    return pathname === path;
  }

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#f8f4e3] text-[#3b4224]">
      {/* Header bar */}
      <header className="w-full bg-[#a0b764] text-[#f9f9ec] shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          {/* Left: logo + title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#f1e4b5] flex items-center justify-center shadow-sm">
              <span className="text-xl">🐐</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-[0.16em] uppercase">
                Wai &amp; Aina Homeapp
              </span>
              <span className="text-[11px] text-[#f5f7eb]/90">
                Daily life &amp; schedule hub
              </span>
            </div>
          </div>

          {/* Center: nav tabs */}
          <nav className="flex items-center gap-4 text-sm font-medium">
            <HubLink href="/hub" active={isActive("/hub")}>
              Schedule
            </HubLink>
            <HubLink href="/hub/request" active={isActive("/hub/request")}>
              Request
            </HubLink>
            <HubLink href="/hub/admin" active={isActive("/hub/admin")}>
              Admin
            </HubLink>
              <HubLink href="/hub/settings" active={isActive("/hub/settings")}>
              Settings
            </HubLink>
          </nav>

          {/* Right: user + logout */}
          <div className="flex items-center gap-3">
            {name && (
              <span className="text-xs uppercase tracking-[0.16em]">
                Logged in as <span className="font-semibold">{name}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="rounded-md border border-[#e5eacc]/60 bg-[#f4f7de]/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#56652f] hover:bg-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Page body */}
      <section className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </section>
    </main>
  );
}

function HubLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 transition-colors ${
        active
          ? "bg-[#f4f7de] text-[#485926] shadow-sm"
          : "text-[#f5f7eb]/90 hover:bg-[#b2c677] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
