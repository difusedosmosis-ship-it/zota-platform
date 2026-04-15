"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiDelete, apiGet } from "@/lib/api";
import { clearSession, readSession } from "@/lib/session";
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

function formatUsername(seed: string | null | undefined) {
  if (!seed) return "Not set";
  return seed
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function VendorAccountPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [vendor, setVendor] = useState<VendorMeResponse["vendor"] | null>(null);
  const session = readSession();
  const username = formatUsername(session?.user.email?.split("@")[0] ?? session?.user.phone);

  const loadAccount = useCallback(async () => {
    const res = await apiGet<VendorMeResponse>("/vendor/me");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setVendor(res.data.vendor);
    setTone("info");
    setStatus("");
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

  async function deleteAccount() {
    const confirmed = window.confirm("Delete this business account permanently? This cannot be undone.");
    if (!confirmed) return;
    setTone("info");
    setStatus("Deleting account...");
    const res = await apiDelete<{ ok: boolean }>("/users/me");
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    clearSession();
    await fetch("/api/session/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Business identity and trust</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Keep the business profile, verification state, and account actions in one place. KYC stays here instead of sitting in the bottom navigation.
          </p>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Business profile</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Username</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{username}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Login email</p>
                <p className="mt-2 break-all text-base font-medium text-slate-950">{session?.user.email ?? "Not set"}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Business name</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{vendor?.businessName ?? "Not set"}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operating area</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{vendor?.city ?? "Not set"}</p>
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
              <Link href="/dashboard?tour=1" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                Start setup tour
              </Link>
              <a className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700" href="mailto:support@zota.app?subject=Zota%20Business%20password%20reset">
                Reset password
              </a>
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
            <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Danger zone</p>
              <p className="mt-2 text-sm text-rose-900">Delete this business account and remove it from Zota Business.</p>
              <button className="mt-4 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={deleteAccount}>
                Delete account
              </button>
            </div>
          </section>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
