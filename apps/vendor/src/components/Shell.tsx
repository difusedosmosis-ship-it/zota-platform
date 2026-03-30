"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearSession, readSession } from "@/lib/session";
import { useState } from "react";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
          : "text-gray-700 border border-black/10 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl border border-black/10 bg-gradient-to-br from-indigo-600 to-purple-600" />
      <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        Zota
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [hasSession] = useState(() => !!readSession());

  return (
    <div className="min-h-screen w-full bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="flex items-center gap-2">
            <NavLink href="/" label="Landing" />
            <NavLink href="/login" label="Login" />
            <NavLink href="/dashboard" label="Dashboard" />
            <NavLink href="/kyc" label="KYC" />
            <NavLink href="/services" label="Services" />
            <NavLink href="/wallet" label="Wallet" />
            <NavLink href="/messages" label="Messages" />
            {hasSession && (
              <button
                className="rounded-full px-4 py-2 text-sm font-medium text-gray-700 border border-black/10 hover:bg-gray-50"
                onClick={() => {
                  clearSession();
                  fetch("/api/session/logout", { method: "POST" }).finally(() => {
                    window.location.href = "/login";
                  });
                }}
              >
                Logout
              </button>
            )}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
