"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type VendorMeResponse = {
  ok: boolean;
  vendor: {
    businessName: string | null;
    kycStatus: string;
    isOnline: boolean;
    city: string | null;
  };
};

type OfferResponse = {
  ok: boolean;
  offer: {
    id: string;
    expiresAt: string;
    request: {
      category: string;
      city: string;
      urgency: string;
    };
  } | null;
};

export default function VendorNotificationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Loading alerts...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [vendor, setVendor] = useState<VendorMeResponse["vendor"] | null>(null);
  const [offer, setOffer] = useState<OfferResponse["offer"]>(null);

  const loadAlerts = useCallback(async () => {
    setTone("info");
    const [vendorRes, offerRes] = await Promise.all([
      apiGet<VendorMeResponse>("/vendor/me"),
      apiGet<OfferResponse>("/requests/vendor/my-offer/latest"),
    ]);

    if (!vendorRes.ok || !vendorRes.data) {
      setTone("error");
      return setStatus(`Failed: ${vendorRes.error}`);
    }

    setVendor(vendorRes.data.vendor);
    if (offerRes.ok && offerRes.data) setOffer(offerRes.data.offer);
    setTone("success");
    setStatus("Alerts ready.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await requireRole(router, "VENDOR");
      if (!session || cancelled) return;
      await loadAlerts();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAlerts, router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Notifications</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Business alerts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Keep request alerts, trust reminders, and operating warnings in one place.
          </p>
        </section>

        <div className="mt-4 space-y-4">
          {offer ? (
            <article className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Request waiting</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">{offer.request.category} in {offer.request.city}</h2>
              <p className="mt-2 text-sm text-slate-600">Urgency: {offer.request.urgency}. Expires {new Date(offer.expiresAt).toLocaleTimeString()}.</p>
              <Link href="/dashboard" className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                Respond in dashboard
              </Link>
            </article>
          ) : null}

          {vendor?.kycStatus !== "APPROVED" ? (
            <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification reminder</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Complete trust setup</h2>
              <p className="mt-2 text-sm text-slate-600">Your current verification status is {vendor?.kycStatus ?? "unknown"}. Finish it to operate without friction.</p>
              <Link href="/account" className="mt-4 inline-flex rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                Open account
              </Link>
            </article>
          ) : null}

          {vendor && !vendor.isOnline ? (
            <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operating status</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Business is offline</h2>
              <p className="mt-2 text-sm text-slate-600">Customers will not see you as available until the business is online again.</p>
              <Link href="/account" className="mt-4 inline-flex rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                Review account
              </Link>
            </article>
          ) : null}

          {!offer && vendor?.kycStatus === "APPROVED" && vendor?.isOnline ? (
            <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">All clear</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">No urgent alerts right now</h2>
              <p className="mt-2 text-sm text-slate-600">Your business is ready in {vendor.city ?? "your area"} and waiting for the next customer request.</p>
            </article>
          ) : null}
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
