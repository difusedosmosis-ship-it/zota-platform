"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { readSession, type SessionUser } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type KycListResponse = { ok: boolean; submissions: Array<{ id: string; status: string }> };
type CategoriesResponse = { ok: boolean; categories: Array<{ id: string; name: string; kind: string }> };
type FinanceSummaryResponse = {
  ok: boolean;
  vendors: Array<{ balance: number }>;
};

type CategoryResponse = { ok: boolean; category: { id: string; name: string } };

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [status, setStatus] = useState("Loading...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [categoryName, setCategoryName] = useState("Plumber");
  const [submissionCount, setSubmissionCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [vendorBalance, setVendorBalance] = useState(0);

  const loadKycCount = useCallback(async () => {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    setTone("info");
    const res = await apiGet<KycListResponse>("/admin/kyc/submissions");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setSubmissionCount(res.data.submissions.length);
    setTone("success");
    setStatus("Dashboard refreshed.");
  }, [router]);

  const loadCategoryCount = useCallback(async () => {
    const res = await apiGet<CategoriesResponse>("/categories");
    if (!res.ok || !res.data) return;
    setCategoryCount(res.data.categories.length);
  }, []);

  const loadFinanceSummary = useCallback(async () => {
    const res = await apiGet<FinanceSummaryResponse>("/admin/finance/vendors");
    if (!res.ok || !res.data) return;
    setVendorBalance(res.data.vendors.reduce((sum, row) => sum + row.balance, 0));
  }, []);

  useEffect(() => {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    const timer = window.setTimeout(() => {
      void Promise.all([loadKycCount(), loadCategoryCount(), loadFinanceSummary()]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router, loadKycCount, loadCategoryCount, loadFinanceSummary]);

  async function createCategory() {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    setTone("info");
    const res = await apiPost<CategoryResponse>(
      "/categories",
      { name: categoryName, kind: "PHYSICAL" }
    );
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setTone("success");
    setStatus(`Created category: ${res.data.category.name}`);
    await loadCategoryCount();
  }

  async function bootstrapDefaultCategories() {
    setTone("info");
    const res = await apiPost<CategoriesResponse>("/categories/bootstrap", {});
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setCategoryCount(res.data.categories.length);
    setTone("success");
    setStatus(`Default categories synced (${res.data.categories.length}).`);
  }

  return (
    <AppShell>
      <section className="bm-grid">
        <article className="bm-card bm-rise-1">
          <h2>Overview</h2>
          <p className="bm-kv">Admin: {user?.email ?? user?.phone}</p>
          <p className="bm-kv">KYC submissions: {submissionCount}</p>
          <p className="bm-kv">Categories: {categoryCount}</p>
          <p className="bm-kv">Vendor balances: NGN {vendorBalance.toLocaleString()}</p>
          <div className="bm-row">
            <button className="bm-btn" onClick={loadKycCount}>Refresh</button>
            <Link className="bm-btn bm-btn-primary" href="/kyc">Open KYC queue</Link>
            <Link className="bm-btn" href="/finance">Open Finance</Link>
          </div>
        </article>

        <article className="bm-card bm-rise-2">
          <h2>Create Category</h2>
          <input className="bm-input" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" />
          <div className="bm-row">
            <button className="bm-btn bm-btn-success" onClick={createCategory}>Create</button>
            <button className="bm-btn bm-btn-primary" onClick={bootstrapDefaultCategories}>Load Default Categories</button>
          </div>
          <p className="bm-status">{status}</p>
        </article>
      </section>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
