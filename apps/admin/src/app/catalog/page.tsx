"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type ReviewService = {
  id: string;
  title: string;
  pricingType: string;
  priceFrom: number | null;
  coverImageUrl: string | null;
  isActive: boolean;
  category: { name: string };
  vendor: {
    businessName: string | null;
    city: string | null;
    user: { email: string | null };
  };
};

type ReviewListing = {
  id: string;
  kind: string;
  title: string;
  city: string | null;
  currency: string;
  pricePerDay: number;
  isActive: boolean;
  vendor: {
    businessName: string | null;
    city: string | null;
    user: { email: string | null };
  } | null;
};

type CatalogReviewResponse = {
  ok: boolean;
  services: ReviewService[];
  listings: ReviewListing[];
};

export default function AdminCatalogPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState<string | null>(null);
  const [services, setServices] = useState<ReviewService[]>([]);
  const [listings, setListings] = useState<ReviewListing[]>([]);

  const loadCatalog = useCallback(async () => {
    const res = await apiGet<CatalogReviewResponse>("/admin/catalog/review");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to load catalog review.");
    }
    setServices(res.data.services);
    setListings(res.data.listings);
    setTone("success");
    setStatus("Catalog review updated.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        await loadCatalog();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadCatalog, router]);

  async function toggleService(id: string, nextState: "publish" | "unpublish") {
    setBusy(`service:${nextState}:${id}`);
    const res = await apiPost<{ ok: boolean }>(`/admin/catalog/services/${id}/${nextState}`, {});
    setBusy(null);
    if (!res.ok) {
      setTone("error");
      return setStatus(res.error ?? `Failed to ${nextState} service.`);
    }
    setTone("success");
    setStatus(`Service ${nextState}ed.`);
    await loadCatalog();
  }

  async function toggleListing(id: string, nextState: "publish" | "unpublish") {
    setBusy(`listing:${nextState}:${id}`);
    const res = await apiPost<{ ok: boolean }>(`/booking/listings/${id}/${nextState}`, {});
    setBusy(null);
    if (!res.ok) {
      setTone("error");
      return setStatus(res.error ?? `Failed to ${nextState} asset.`);
    }
    setTone("success");
    setStatus(`Asset ${nextState}ed.`);
    await loadCatalog();
  }

  const pendingServices = useMemo(() => services.filter((row) => !row.isActive), [services]);
  const liveServices = useMemo(() => services.filter((row) => row.isActive), [services]);
  const pendingListings = useMemo(() => listings.filter((row) => !row.isActive), [listings]);
  const liveListings = useMemo(() => listings.filter((row) => row.isActive), [listings]);

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Catalog review</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Review vendor services and assets before consumers see them</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                New or edited services and reserve-now assets remain pending until the office publishes them.
              </p>
            </div>
            <button className="bm-btn bm-btn-primary" onClick={loadCatalog}>Refresh</button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Pending services</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{pendingServices.length}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live services</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{liveServices.length}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Pending assets</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{pendingListings.length}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live assets</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{liveListings.length}</p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Service queue</p>
            <div className="mt-4 space-y-3">
              {services.length === 0 ? <p className="text-sm text-slate-500">No services submitted yet.</p> : services.map((row) => (
                <article key={row.id} className="rounded-[22px] border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{row.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{row.vendor.businessName ?? "Unnamed business"} · {row.category.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{row.vendor.user.email ?? "no-email"}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {row.isActive ? "Live" : "Pending"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="bm-btn bm-btn-success" disabled={busy === `service:publish:${row.id}`} onClick={() => toggleService(row.id, "publish")}>
                      {busy === `service:publish:${row.id}` ? "Publishing..." : "Publish"}
                    </button>
                    <button className="bm-btn bm-btn-warn" disabled={busy === `service:unpublish:${row.id}`} onClick={() => toggleService(row.id, "unpublish")}>
                      {busy === `service:unpublish:${row.id}` ? "Updating..." : "Unpublish"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Asset queue</p>
            <div className="mt-4 space-y-3">
              {listings.length === 0 ? <p className="text-sm text-slate-500">No assets submitted yet.</p> : listings.map((row) => (
                <article key={row.id} className="rounded-[22px] border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{row.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{row.kind} · {row.vendor?.businessName ?? "Unassigned vendor"}</p>
                      <p className="mt-1 text-sm text-slate-500">{row.vendor?.user.email ?? "no-email"}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {row.isActive ? "Live" : "Pending"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="bm-btn bm-btn-success" disabled={busy === `listing:publish:${row.id}`} onClick={() => toggleListing(row.id, "publish")}>
                      {busy === `listing:publish:${row.id}` ? "Publishing..." : "Publish"}
                    </button>
                    <button className="bm-btn bm-btn-warn" disabled={busy === `listing:unpublish:${row.id}`} onClick={() => toggleListing(row.id, "unpublish")}>
                      {busy === `listing:unpublish:${row.id}` ? "Updating..." : "Unpublish"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
