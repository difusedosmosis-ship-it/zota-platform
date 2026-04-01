"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const netFlow = useMemo(() => (summary ? summary.credits - summary.debits : 0), [summary]);

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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Wallet</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Business earnings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Track booking revenue, service payouts, and wallet movement from one earnings command view.
              </p>
            </div>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={loadFinance}>
              Refresh wallet
            </button>
          </div>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#022c22_0%,#064e3b_100%)] p-5 text-white shadow-[0_18px_38px_rgba(2,44,34,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Available balance</p>
            <p className="mt-4 text-3xl font-black tracking-[-0.05em]">NGN {summary?.balance.toLocaleString() ?? "0"}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Total credits</p>
            <p className="mt-4 text-3xl font-black tracking-[-0.05em] text-slate-950">NGN {summary?.credits.toLocaleString() ?? "0"}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Total debits</p>
            <p className="mt-4 text-3xl font-black tracking-[-0.05em] text-slate-950">NGN {summary?.debits.toLocaleString() ?? "0"}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Net flow</p>
            <p className={`mt-4 text-3xl font-black tracking-[-0.05em] ${netFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              NGN {netFlow.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Payout readiness</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Keep earnings healthy</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-[22px] bg-slate-50 p-4">
                Your current balance reflects completed jobs, confirmed bookings, and other wallet credits already settled into vendor funds.
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                Use KYC and business profile completion to reduce payout friction and improve trust visibility across the marketplace.
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                Every wallet movement stays in the ledger below for finance review, dispute checks, and payout tracing.
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Ledger activity</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Money movement</h2>
              </div>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">{summary?.rows ?? 0} rows</span>
            </div>

            <div className="mt-4 space-y-3">
              {rows.length === 0 ? (
                <div className="rounded-[22px] bg-slate-50 p-4 text-sm leading-6 text-slate-500">No finance activity yet.</div>
              ) : (
                rows.map((row) => (
                  <article key={row.id} className="rounded-[24px] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{row.reason}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(row.createdAt).toLocaleString()}</p>
                        {row.refType && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{row.refType}</p>}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${row.amount >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {row.amount >= 0 ? "+" : ""}{row.currency} {row.amount.toLocaleString()}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
