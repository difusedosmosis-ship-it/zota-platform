"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { readSession, type SessionUser } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type KycListResponse = {
  ok: boolean;
  submissions: Array<{ id: string; status: string }>;
};
type CategoriesResponse = {
  ok: boolean;
  categories: Array<{ id: string; name: string; kind: string }>;
};
type FinanceSummaryResponse = {
  ok: boolean;
  vendors: Array<{
    vendorId: string;
    businessName: string | null;
    kycStatus: string;
    balance: number;
    earnings: number;
    payouts: number;
  }>;
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
  const [submissionCount, setSubmissionCount] = useState(0);
  const [pendingKycCount, setPendingKycCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [vendorBalance, setVendorBalance] = useState(0);
  const [approvedVendors, setApprovedVendors] = useState(0);
  const [vendors, setVendors] = useState<FinanceSummaryResponse["vendors"]>([]);

  const loadKycCount = useCallback(async () => {
    const res = await apiGet<KycListResponse>("/admin/kyc/submissions");
    if (!res.ok || !res.data) throw new Error(res.error ?? "Failed to load KYC queue");
    setSubmissionCount(res.data.submissions.length);
    setPendingKycCount(res.data.submissions.filter((row) => row.status === "PENDING" || row.status === "UNDER_REVIEW").length);
  }, []);

  const loadCategoryCount = useCallback(async () => {
    const res = await apiGet<CategoriesResponse>("/categories");
    if (!res.ok || !res.data) throw new Error(res.error ?? "Failed to load categories");
    setCategoryCount(res.data.categories.length);
  }, []);

  const loadFinanceSummary = useCallback(async () => {
    const res = await apiGet<FinanceSummaryResponse>("/admin/finance/vendors");
    if (!res.ok || !res.data) throw new Error(res.error ?? "Failed to load finance summary");
    setVendors(res.data.vendors);
    setVendorBalance(res.data.vendors.reduce((sum, row) => sum + row.balance, 0));
    setApprovedVendors(res.data.vendors.filter((row) => row.kycStatus === "APPROVED").length);
  }, []);

  const loadOffice = useCallback(async () => {
    setTone("info");
    setStatus("Refreshing office data...");
    try {
      await Promise.all([loadKycCount(), loadCategoryCount(), loadFinanceSummary()]);
      setTone("success");
      setStatus("Office updated.");
    } catch (error) {
      setTone("error");
      setStatus(error instanceof Error ? error.message : "Failed to refresh office data.");
    }
  }, [loadCategoryCount, loadFinanceSummary, loadKycCount]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        setUser(session.user);
        await loadOffice();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadOffice, router]);

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
    await loadCategoryCount();
  }

  async function bootstrapDefaultCategories() {
    setTone("info");
    setStatus("Syncing default categories...");
    const res = await apiPost<CategoriesResponse>("/categories/bootstrap", {});
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to sync categories.");
    }
    setCategoryCount(res.data.categories.length);
    setTone("success");
    setStatus(`Default categories synced (${res.data.categories.length}).`);
  }

  const topVendors = useMemo(() => vendors.slice(0, 5), [vendors]);
  const identity = formatIdentity(user);

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(145deg,#050816_0%,#0b1220_55%,#111827_100%)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">Zota Office</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">Good day, {identity}</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            The office is responsible for marketplace trust, category governance, vendor finance, and platform oversight across all Zota products.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="bm-btn bm-btn-primary" onClick={loadOffice}>Refresh office</button>
            <Link className="bm-btn" href="/kyc">Verification queue</Link>
            <Link className="bm-btn" href="/finance">Finance desk</Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Verification queue</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{pendingKycCount}</p>
            <p className="mt-2 text-sm text-slate-500">Pending approvals needing office action.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Total submissions</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{submissionCount}</p>
            <p className="mt-2 text-sm text-slate-500">Full verification history in the system.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Approved businesses</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{approvedVendors}</p>
            <p className="mt-2 text-sm text-slate-500">Businesses cleared to operate on the marketplace.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Category count</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{categoryCount}</p>
            <p className="mt-2 text-sm text-slate-500">Taxonomy driving vendor setup and consumer discovery.</p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Category governance</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Add and standardize live marketplace categories</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Categories control how vendors publish services, how dispatch requests are classified, and how customers discover businesses.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input className="bm-input" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" />
              <button className="bm-btn bm-btn-success" onClick={createCategory}>Create category</button>
            </div>
            <button className="mt-3 bm-btn" onClick={bootstrapDefaultCategories}>Sync default categories</button>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Finance overview</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Vendor money currently inside the system</h3>
            <div className="mt-4 rounded-[24px] bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Combined vendor balances</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">NGN {vendorBalance.toLocaleString()}</p>
            </div>
            <div className="mt-4 space-y-3">
              {topVendors.length === 0 ? (
                <p className="text-sm text-slate-500">No vendor finance data loaded yet.</p>
              ) : (
                topVendors.map((vendor) => (
                  <div key={vendor.vendorId} className="rounded-[20px] border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{vendor.businessName ?? "Unnamed business"}</p>
                        <p className="mt-1 text-sm text-slate-500">{vendor.kycStatus}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-950">NGN {vendor.balance.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">earnings {vendor.earnings.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
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
