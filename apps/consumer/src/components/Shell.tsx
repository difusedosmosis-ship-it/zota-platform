"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearSession, readSession } from "@/lib/session";
import { useMemo, useState } from "react";
import { ZotaLogo } from "@/components/ZotaLogo";

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-label={label} className="bm-icon-btn">
      {children}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 3v-3H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 16v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v2" />
      <path d="m14 12-9 0" />
      <path d="m8 9-3 3 3 3" />
    </svg>
  );
}

type FooterItem = {
  href: string;
  label: string;
  icon: "home" | "nearby" | "requests" | "wallet" | "profile";
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v9h14v-9" />
      <path d="M9 19v-5h6v5" />
    </svg>
  );
}

function NearbyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function RequestsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <circle cx="16.5" cy="13.5" r="1.4" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

function FooterIcon({ name }: { name: FooterItem["icon"] }) {
  if (name === "home") return <HomeIcon />;
  if (name === "nearby") return <NearbyIcon />;
  if (name === "requests") return <RequestsIcon />;
  if (name === "wallet") return <WalletIcon />;
  return <ProfileIcon />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [hasSession] = useState(() => !!readSession());
  const pathname = usePathname();

  const footerItems = useMemo<FooterItem[]>(
    () => [
      { href: "/dashboard", label: "Explore", icon: "home" },
      { href: "/bookings", label: "Nearby", icon: "nearby" },
      { href: "/requests", label: "Requests", icon: "requests" },
      { href: "/wallet", label: "Wallet", icon: "wallet" },
      { href: "/profile", label: "Account", icon: "profile" },
    ],
    [],
  );

  return (
    <div className="bm-safe-page min-h-screen w-full bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <ZotaLogo size={40} compact />
          </div>

          <div className="flex items-center gap-2">
            {hasSession ? (
              <>
                <IconButton href="/messages" label="Messages">
                  <MessageIcon />
                </IconButton>
                <IconButton href="/notifications" label="Notifications">
                  <BellIcon />
                </IconButton>
              </>
            ) : (
              <IconButton href="/login" label="Login">
                <LoginIcon />
              </IconButton>
            )}
          </div>
        </div>
      </header>

      <main style={{ paddingBottom: "max(86px, calc(74px + var(--safe-bottom)))" }}>{children}</main>

      <footer className="bm-mobile-footer">
        {footerItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={`bm-footer-item ${active ? "is-active" : ""}`}>
              <span className="bm-footer-icon"><FooterIcon name={item.icon} /></span>
              <span className="bm-footer-label">{item.label}</span>
            </Link>
          );
        })}
      </footer>
    </div>
  );
}
