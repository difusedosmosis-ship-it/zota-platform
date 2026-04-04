"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet } from "@/lib/api";
import { clearSession } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type VendorMeResponse = {
  ok: boolean;
  vendor: {
    businessName: string | null;
    city: string | null;
    coverageKm: number;
    isOnline: boolean;
    kycStatus: string;
    kycNote: string | null;
  };
};

export default function VendorAccountPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Loading account...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [vendor, setVendor] = useState<VendorMeResponse["vendor"] | null>(null);

  const loadAccount = useCallback(async () => {
    setTone("info");
    const res = await apiGet<VendorMeResponse>("/vendor/me");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setVendor(res.data.vendor);
    setTone("success");
    setStatus("Account ready.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await requireRole(router, "VENDOR");
      if (!session || cancelled) return;
      await loadAccount();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAccount, router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Account</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Business identity and trust</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Keep the business profile, verification state, and account actions in one place. KYC stays here instead of sitting in the bottom navigation.
          </p>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Business profile</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Business name</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{vendor?.businessName ?? "Not set"}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operating city</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{vendor?.city ?? "Not set"}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Coverage radius</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{vendor?.coverageKm ?? 0} km</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Verification</p>
            <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current status</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{vendor?.kycStatus ?? "Unknown"}</p>
              {vendor?.kycNote ? <p className="mt-2 text-sm text-slate-500">{vendor.kycNote}</p> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/kyc" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                Open verification
              </Link>
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                onClick={() => {
                  clearSession();
                  fetch("/api/session/logout", { method: "POST" }).finally(() => {
                    window.location.href = "/login";
                  });
                }}
              >
                Logout
              </button>
            </div>
          </section>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
