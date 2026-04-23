"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type LedgerRow = {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
};

type TransactionRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
};

type LedgerResponse = {
  ok: boolean;
  balance: number;
  rows: LedgerRow[];
};

type TransactionsResponse = {
  ok: boolean;
  rows: TransactionRow[];
};

type PaymentInitResponse = {
  ok: boolean;
  payment: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export default function WalletPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Loading wallet...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [balance, setBalance] = useState(0);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [topupAmount, setTopupAmount] = useState(5000);

  const loadWallet = useCallback(async () => {
    setTone("info");
    const [ledgerRes, txRes] = await Promise.all([
      apiGet<LedgerResponse>("/wallet/me/ledger"),
      apiGet<TransactionsResponse>("/wallet/me/transactions"),
    ]);

    if (!ledgerRes.ok || !ledgerRes.data) {
      setTone("error");
      return setStatus(`Failed: ${ledgerRes.error}`);
    }

    setBalance(ledgerRes.data.balance);
    setLedgerRows(ledgerRes.data.rows);
    if (txRes.ok && txRes.data) setTransactions(txRes.data.rows);

    setTone("success");
    setStatus("Wallet loaded.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "CONSUMER");
        if (!session || cancelled) return;
        await loadWallet();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, loadWallet]);

  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference) return;

    const timer = window.setTimeout(async () => {
      setTone("info");
      setStatus("Verifying payment...");
      const res = await apiPost<{ ok: boolean; result: { type: string } }>("/payments/verify", { reference });
      if (!res.ok) {
        setTone("error");
        setStatus(`Failed: ${res.error}`);
        return;
      }
      await loadWallet();
      setTone("success");
      setStatus("Payment verified.");
      router.replace("/wallet");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams, loadWallet, router]);

  async function startTopup() {
    setTone("info");
    setStatus("Initializing top-up...");
    const callbackUrl =
      typeof window !== "undefined" && /^https?:/i.test(window.location.origin)
        ? `${window.location.origin}/wallet`
        : undefined;
    const res = await apiPost<PaymentInitResponse>("/payments/topup/init", {
      amount: topupAmount,
      callbackUrl,
    });
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }

    setTone("success");
    setStatus("Redirecting to payment...");
    window.location.assign(res.data.payment.authorization_url);
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
            <p className="text-gray-600 mt-1">Track ledger entries, payment rows, and booking charge activity.</p>
          </div>
          <button className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50" onClick={loadWallet}>
            Refresh
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Balance</p>
          <p className={`mt-2 text-4xl font-bold ${balance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            NGN {balance.toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-gray-500">Current wallet layer is ledger-first. Automated card capture and split payout are still pending.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="w-full rounded-xl border border-gray-300 px-4 py-3 sm:max-w-xs"
              type="number"
              min={100}
              step={100}
              value={topupAmount}
              onChange={(e) => setTopupAmount(Number(e.target.value))}
            />
            <button className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700" onClick={startTopup}>
              Top Up With Card
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Ledger</h2>
            <div className="mt-4 space-y-3">
              {ledgerRows.length === 0 ? (
                <p className="text-sm text-gray-600">No wallet ledger entries yet.</p>
              ) : (
                ledgerRows.map((row) => (
                  <article key={row.id} className="rounded-xl bg-slate-50 p-3">
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

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Transactions</h2>
            <div className="mt-4 space-y-3">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-600">No payment transactions yet.</p>
              ) : (
                transactions.map((row) => (
                  <article key={row.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{row.provider ?? "wallet"}</p>
                        <p className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {row.currency} {row.amount.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">Status: {row.status}</p>
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
