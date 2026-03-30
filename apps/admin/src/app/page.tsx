"use client";

import Link from "next/link";
import { AppShell } from "@/components/Shell";

export default function AdminLandingPage() {
  return (
    <AppShell>
      <section className="bm-hero bm-rise-1">
        <span className="bm-pill">Admin Console</span>
        <h2 className="bm-title">Run moderation and KYC approvals from a focused control center.</h2>
        <p className="bm-sub">Use the dedicated routes for login, dashboard insights, and approval queue.</p>
        <div className="bm-row">
          <Link className="bm-btn bm-btn-primary" href="/login">Admin login</Link>
          <Link className="bm-btn" href="/dashboard">Dashboard</Link>
          <Link className="bm-btn" href="/kyc">KYC queue</Link>
        </div>
      </section>
    </AppShell>
  );
}
