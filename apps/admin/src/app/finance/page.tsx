"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type VendorFinanceRow = {
  vendorId: string;
  userId: string;
  businessName: string | null;
  email: string | null;
  kycStatus: string;
  balance: number;
  earnings: number;
  payouts: number;
};

type FinanceResponse = {
  ok: boolean;
  vendors: VendorFinanceRow[];
};

export default function AdminFinancePage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [vendors, setVendors] = useState<VendorFinanceRow[]>([]);
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  const loadFinance = useCallback(async () => {
    setTone("info");
    const res = await apiGet<FinanceResponse>("/admin/finance/vendors");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to load finance data.");
    }
    setVendors(res.data.vendors);
    setTone("success");
    setStatus(`Loaded ${res.data.vendors.length} vendor finance row(s).`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        await loadFinance();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadFinance, router]);

  async function payVendor(vendorId: string) {
    const amount = amounts[vendorId];
    if (!amount || amount <= 0) {
      setTone("error");
      setStatus("Enter a payout amount first.");
      return;
    }

    setBusyVendorId(vendorId);
    setTone("info");
    setStatus("Recording manual payout...");
    const res = await apiPost<{ ok: boolean }>("/admin/finance/payouts/manual", {
      vendorId,
      amount,
      note: "Manual vendor payout from Zota Office",
    });
    setBusyVendorId(null);

    if (!res.ok) {
      setTone("error");
      return setStatus(res.error ?? "Failed to record payout.");
    }

    setTone("success");
    setStatus("Manual payout recorded.");
    await loadFinance();
  }

  const totals = useMemo(
    () => ({
      balance: vendors.reduce((sum, vendor) => sum + vendor.balance, 0),
      earnings: vendors.reduce((sum, vendor) => sum + vendor.earnings, 0),
      payouts: vendors.reduce((sum, vendor) => sum + vendor.payouts, 0),
    }),
    [vendors],
  );

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Finance Desk</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Review balances and record vendor payouts</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                This desk monitors money sitting with vendors and lets the office record manual payouts where needed.
              </p>
            </div>
            <button className="bm-btn bm-btn-primary" onClick={loadFinance}>Refresh finance</button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Balance</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">NGN {totals.balance.toLocaleString()}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Earnings</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">NGN {totals.earnings.toLocaleString()}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Payouts</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">NGN {totals.payouts.toLocaleString()}</p>
          </article>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Vendor finance rows</p>
          <div className="mt-4 space-y-3">
            {vendors.length === 0 ? (
              <p className="text-sm text-slate-500">No vendor finance data loaded yet.</p>
            ) : (
              vendors.map((vendor) => (
                <article key={vendor.vendorId} className="rounded-[24px] border border-slate-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{vendor.businessName ?? "Unnamed business"}</p>
                      <p className="mt-1 text-sm text-slate-500">{vendor.email ?? "no-email"}</p>
                      <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">{vendor.kycStatus}</p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 sm:text-right">
                      <p><span className="font-semibold text-slate-950">Balance:</span> NGN {vendor.balance.toLocaleString()}</p>
                      <p><span className="font-semibold text-slate-950">Earnings:</span> NGN {vendor.earnings.toLocaleString()}</p>
                      <p><span className="font-semibold text-slate-950">Payouts:</span> NGN {vendor.payouts.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      className="bm-input"
                      type="number"
                      min={0}
                      step={100}
                      placeholder="Payout amount"
                      value={amounts[vendor.vendorId] ?? ""}
                      onChange={(e) =>
                        setAmounts((current) => ({
                          ...current,
                          [vendor.vendorId]: Number(e.target.value),
                        }))
                      }
                    />
                    <button className="bm-btn bm-btn-success" disabled={busyVendorId === vendor.vendorId} onClick={() => payVendor(vendor.vendorId)}>
                      {busyVendorId === vendor.vendorId ? "Recording..." : "Record payout"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
