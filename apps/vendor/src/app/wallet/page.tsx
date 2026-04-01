"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type SummaryResponse = {
  ok: boolean;
  summary: {
    balance: number;
    credits: number;
    debits: number;
    rows: number;
  };
};

type LedgerRow = {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
};

type LedgerResponse = {
  ok: boolean;
  balance: number;
  rows: LedgerRow[];
};

export default function VendorWalletPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Loading earnings...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [summary, setSummary] = useState<SummaryResponse["summary"] | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);

  const loadFinance = useCallback(async () => {
    setTone("info");
    const [summaryRes, ledgerRes] = await Promise.all([
      apiGet<SummaryResponse>("/wallet/me/summary"),
      apiGet<LedgerResponse>("/wallet/me/ledger"),
    ]);

    if (!summaryRes.ok || !summaryRes.data || !ledgerRes.ok || !ledgerRes.data) {
      setTone("error");
      return setStatus(`Failed: ${summaryRes.error ?? ledgerRes.error}`);
    }

    setSummary(summaryRes.data.summary);
    setRows(ledgerRes.data.rows);
    setTone("success");
    setStatus("Earnings loaded.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "VENDOR");
        if (!session || cancelled) return;
        await loadFinance();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, loadFinance]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Wallet</h1>
            <p className="text-gray-600 mt-1">Track service earnings, booking earnings, and manual payouts.</p>
          </div>
          <button className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50" onClick={loadFinance}>
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Available Balance</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">NGN {summary?.balance.toLocaleString() ?? "0"}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Total Credits</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">NGN {summary?.credits.toLocaleString() ?? "0"}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Total Payouts / Debits</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">NGN {summary?.debits.toLocaleString() ?? "0"}</p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Ledger Activity</h2>
          <div className="mt-4 space-y-3">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-600">No finance activity yet.</p>
            ) : (
              rows.map((row) => (
                <article key={row.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{row.reason}</p>
                      <p className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`text-sm font-bold ${row.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {row.amount >= 0 ? "+" : ""}{row.currency} {row.amount.toLocaleString()}
                    </span>
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
