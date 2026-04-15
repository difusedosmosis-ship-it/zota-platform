"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { readSession, type SessionUser } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type OverviewResponse = {
  ok: boolean;
  overview: {
    users: { consumers: number; vendors: number; admins: number; total: number };
    vendors: { total: number; approved: number; online: number };
    kyc: { total: number; pending: number };
    categories: { total: number; latest: Array<{ id: string; name: string; kind: string }> };
    requests: { total: number; activeJobs: number; queuedJobs: number; byStatus: Record<string, number> };
    communications: { conversations: number; messages: number };
    latestKyc: Array<{ id: string; status: string; createdAt: string; businessName: string | null; email: string | null }>;
    latestVendors: Array<{ id: string; businessName: string | null; isOnline: boolean; kycStatus: string; updatedAt: string }>;
  };
};

type CategoryResponse = { ok: boolean; category: { id: string; name: string } };

function formatIdentity(user: SessionUser | null) {
  const seed = user?.email?.split("@")[0] ?? user?.phone ?? "Office User";
  return seed
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [categoryName, setCategoryName] = useState("");
  const [overview, setOverview] = useState<OverviewResponse["overview"] | null>(null);

  const loadOffice = useCallback(async (silent = false) => {
    if (!silent) {
      setTone("info");
      setStatus("Refreshing office data...");
    }
    const res = await apiGet<OverviewResponse>("/admin/overview");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to refresh office data.");
    }
    setOverview(res.data.overview);
    if (!silent) {
      setTone("success");
      setStatus("Office updated.");
    } else {
      setTone("info");
      setStatus("");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        setUser(session.user);
        await loadOffice(true);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadOffice, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOffice(true);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadOffice]);

  async function createCategory() {
    if (!categoryName.trim()) {
      setTone("error");
      setStatus("Enter a category name.");
      return;
    }
    setTone("info");
    setStatus("Creating category...");
    const res = await apiPost<CategoryResponse>("/categories", { name: categoryName.trim(), kind: "PHYSICAL" });
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to create category.");
    }
    setCategoryName("");
    setTone("success");
    setStatus(`Created category: ${res.data.category.name}`);
    await loadOffice(true);
  }

  async function bootstrapDefaultCategories() {
    setTone("info");
    setStatus("Syncing default categories...");
    const res = await apiPost<{ ok: boolean; categories: Array<{ id: string }> }>("/categories/bootstrap", {});
    if (!res.ok) {
      setTone("error");
      return setStatus(res.error ?? "Failed to sync categories.");
    }
    setTone("success");
    setStatus("Default categories synced.");
    await loadOffice(true);
  }

  const requestStatusEntries = useMemo(
    () => Object.entries(overview?.requests.byStatus ?? {}).sort((a, b) => b[1] - a[1]),
    [overview?.requests.byStatus],
  );

  const identity = formatIdentity(user);

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(145deg,#050816_0%,#0b1220_55%,#111827_100%)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">Zota Office</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">Good day, {identity}</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                The office oversees verification, live jobs, categories, business approvals, and communication activity across the entire marketplace.
              </p>
            </div>
            <button className="bm-btn !rounded-full !px-3" onClick={() => void loadOffice()} aria-label="Refresh office">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Verification queue</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{overview?.kyc.pending ?? 0}</p>
            <p className="mt-2 text-sm text-slate-500">Businesses waiting for office approval.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live jobs</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{overview?.requests.activeJobs ?? 0}</p>
            <p className="mt-2 text-sm text-slate-500">Requests currently accepted or in progress.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Queued work</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{overview?.requests.queuedJobs ?? 0}</p>
            <p className="mt-2 text-sm text-slate-500">Requests still being dispatched or awaiting vendor response.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Active businesses</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{overview?.vendors.online ?? 0}</p>
            <p className="mt-2 text-sm text-slate-500">Approved businesses currently open for the marketplace.</p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">System awareness</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Users, businesses, and communications</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Consumers</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{overview?.users.consumers ?? 0}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Businesses</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{overview?.users.vendors ?? 0}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Admins</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{overview?.users.admins ?? 0}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Approved businesses</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{overview?.vendors.approved ?? 0}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Conversations</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{overview?.communications.conversations ?? 0}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent messages</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{overview?.communications.messages ?? 0}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Category governance</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Live category registry</h3>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input className="bm-input" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" />
              <button className="bm-btn bm-btn-success" onClick={createCategory}>Create category</button>
            </div>
            <button className="mt-3 bm-btn" onClick={bootstrapDefaultCategories}>Sync default categories</button>
            <div className="mt-4 flex flex-wrap gap-2">
              {(overview?.categories.latest ?? []).map((category) => (
                <span key={category.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {category.name}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Request dashboard</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Live request states across the marketplace</h3>
            <div className="mt-4 space-y-3">
              {requestStatusEntries.length === 0 ? (
                <p className="text-sm text-slate-500">No request activity yet.</p>
              ) : (
                requestStatusEntries.map(([state, count]) => (
                  <div key={state} className="flex items-center justify-between rounded-[20px] border border-slate-200 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-700">{state.replaceAll("_", " ")}</span>
                    <span className="text-base font-semibold text-slate-950">{count}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Latest verification activity</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Newest submissions entering the office</h3>
            <div className="mt-4 space-y-3">
              {(overview?.latestKyc ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No recent KYC activity.</p>
              ) : (
                overview!.latestKyc.map((row) => (
                  <article key={row.id} className="rounded-[20px] border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{row.businessName ?? "Unnamed business"}</p>
                        <p className="mt-1 text-sm text-slate-500">{row.email ?? "no-email"}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                        {row.status}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
