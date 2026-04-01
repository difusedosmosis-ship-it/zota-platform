"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearSession, readSession } from "@/lib/session";
import { useMemo, useState } from "react";
import { ZotaLogo } from "@/components/ZotaLogo";

function MenuLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`bm-menu-link ${
        active
          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "text-gray-700 border-black/10 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}

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
  icon: "home" | "booking" | "track" | "wallet" | "profile";
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

function BookingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M8 14h3M13 14h3M8 17h3" />
    </svg>
  );
}

function TrackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
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
  if (name === "booking") return <BookingIcon />;
  if (name === "track") return <TrackIcon />;
  if (name === "wallet") return <WalletIcon />;
  return <ProfileIcon />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [hasSession] = useState(() => !!readSession());
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const footerItems = useMemo<FooterItem[]>(
    () => [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/bookings", label: "Booking", icon: "booking" },
      { href: "/requests", label: "Track", icon: "track" },
      { href: "/wallet", label: "Wallet", icon: "wallet" },
      { href: "/profile", label: "Profile", icon: "profile" },
    ],
    [],
  );

  return (
    <div className="bm-safe-page min-h-screen w-full bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              aria-label="Open menu"
              className="bm-icon-btn"
              onClick={() => setMenuOpen(true)}
            >
              <span className="bm-hamburger" />
            </button>
            <ZotaLogo size={40} compact />
          </div>

          <div className="flex items-center gap-2">
            {hasSession ? (
              <>
                <IconButton href="/notifications" label="Notifications">
                  <BellIcon />
                </IconButton>
                <IconButton href="/messages" label="Messages">
                  <MessageIcon />
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

      {menuOpen && (
        <>
          <button className="bm-overlay" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside className="bm-side-sheet">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Menu</h3>
              <button className="bm-icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <MenuLink href="/dashboard" label="Home" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/bookings" label="Bookings" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/requests" label="Track Requests" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/messages" label="Messages & Calls" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/wallet" label="Wallet" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/profile" label="Profile" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/notifications" label="Alerts" onClick={() => setMenuOpen(false)} />
            </div>

            {hasSession && (
              <button
                className="mt-5 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 border border-black/10 hover:bg-gray-50"
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
          </aside>
        </>
      )}

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
