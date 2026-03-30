"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [status, setStatus] = useState("Loading finance...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [vendors, setVendors] = useState<VendorFinanceRow[]>([]);
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  const loadFinance = useCallback(async () => {
    setTone("info");
    const res = await apiGet<FinanceResponse>("/admin/finance/vendors");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setVendors(res.data.vendors);
    setTone("success");
    setStatus(`Loaded ${res.data.vendors.length} vendor finance row(s).`);
  }, []);

  useEffect(() => {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    const timer = window.setTimeout(() => {
      void loadFinance();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router, loadFinance]);

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
      note: "Manual vendor payout from admin finance",
    });
    setBusyVendorId(null);

    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }

    setTone("success");
    setStatus("Manual payout recorded.");
    await loadFinance();
  }

  return (
    <AppShell>
      <section className="bm-card bm-rise-1">
        <h2>Vendor Finance</h2>
        <div className="bm-row">
          <button className="bm-btn bm-btn-primary" onClick={loadFinance}>Refresh finance</button>
        </div>
        <ul className="bm-list">
          {vendors.map((vendor) => (
            <li key={vendor.vendorId}>
              <strong>{vendor.businessName ?? "Unnamed Vendor"}</strong> ({vendor.email ?? "no-email"}) | {vendor.kycStatus}
              <div style={{ marginTop: 8 }}>
                Balance: NGN {vendor.balance.toLocaleString()} | Earnings: NGN {vendor.earnings.toLocaleString()} | Payouts: NGN {vendor.payouts.toLocaleString()}
              </div>
              <div className="bm-row" style={{ marginTop: 8 }}>
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
                  {busyVendorId === vendor.vendorId ? "Paying..." : "Record Payout"}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <StatusToast message={status} tone={tone} />
      </section>
    </AppShell>
  );
}
