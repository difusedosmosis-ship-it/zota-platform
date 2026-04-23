"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { pushNotification } from "@/lib/notifications";
import { readSession, restoreSessionFromServer, type SessionUser } from "@/lib/session";

type VendorReviewResponse = {
  ok: boolean;
  summary: { averageRating: number; totalReviews: number };
  reviews?: Array<{
    id: string;
    rating: number;
    body: string | null;
    createdAt: string;
    consumer: { fullName: string | null };
  }>;
};

type RequestCreateResponse = { ok: boolean; id: string };

export default function ConsumerVendorDetailPage() {
  const router = useRouter();
  const params = useParams<{ vendorId: string }>();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [status, setStatus] = useState("Loading service...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busyAction, setBusyAction] = useState<"" | "request" | "location">("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ averageRating: number; totalReviews: number }>({
    averageRating: 0,
    totalReviews: 0,
  });

  const vendorId = String(params.vendorId ?? "");
  const businessName = searchParams.get("businessName") ?? "Verified business";
  const serviceTitle = searchParams.get("serviceTitle") ?? "Service request";
  const category = searchParams.get("category") ?? "Business";
  const city = searchParams.get("city") ?? "Nigeria";
  const image = searchParams.get("image") ?? "";
  const serviceId = searchParams.get("serviceId") ?? "";

  const messageHref = useMemo(() => {
    const next = new URLSearchParams({
      vendorId,
      message: `Hello, I want to ask about ${serviceTitle}.`,
    });
    if (serviceId) next.set("serviceId", serviceId);
    return `/messages?${next.toString()}`;
  }, [serviceId, serviceTitle, vendorId]);

  async function bootstrap() {
    const session = readSession() ?? (await restoreSessionFromServer());
    if (session?.user.role === "CONSUMER") setUser(session.user);

    const reviewRes = await apiGet<VendorReviewResponse>(`/reviews/vendor/${vendorId}?limit=5`);
    if (reviewRes.ok && reviewRes.data) {
      setReviewSummary(reviewRes.data.summary);
    }
    setTone("success");
    setStatus("Service ready.");
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        await bootstrap();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, vendorId]);

  async function ensureLocation() {
    if (lat != null && lng != null) return { lat, lng };
    if (!navigator.geolocation) {
      setTone("error");
      setStatus("Location is not supported on this device.");
      return null;
    }

    setBusyAction("location");
    setTone("info");
    setStatus("Detecting your location...");

    return await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLat(next.lat);
          setLng(next.lng);
          setBusyAction("");
          setTone("success");
          setStatus("Location connected.");
          resolve(next);
        },
        () => {
          setBusyAction("");
          setTone("error");
          setStatus("Could not access your location.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  async function createRequest() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/vendors/${vendorId}`)}`);
      return;
    }
    const position = await ensureLocation();
    if (!position) return;

    setBusyAction("request");
    setTone("info");
    setStatus("Sending request...");

    const res = await apiPost<RequestCreateResponse>("/requests", {
      mode: "CHOOSE",
      vendorId,
      city,
      category,
      description: `Need ${serviceTitle} from ${businessName}.`,
      urgency: "normal",
      lat: position.lat,
      lng: position.lng,
    });

    setBusyAction("");
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(res.error ?? "Could not create request.");
      return;
    }

    setTone("success");
    setStatus(`Request ${res.data.id.slice(0, 8)} created.`);
    pushNotification({
      title: "Request sent",
      body: `${serviceTitle} request has been sent to ${businessName}.`,
      href: "/requests",
    });
    router.push(`/requests?created=${encodeURIComponent(res.data.id)}`);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 pb-8 pt-5 sm:px-6">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18 9 12l6-6" />
          </svg>
          Back
        </button>

        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_22px_48px_rgba(15,23,42,0.08)]">
          {image ? (
            <img src={image} alt={businessName} className="h-64 w-full object-cover" />
          ) : (
            <div className="h-52 w-full bg-[linear-gradient(135deg,#042f2e_0%,#0f172a_100%)]" />
          )}
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{category}</p>
                <h1 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-950">{businessName}</h1>
                <p className="mt-2 text-base text-slate-600">{serviceTitle}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Rating</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {reviewSummary.totalReviews ? reviewSummary.averageRating.toFixed(1) : "New"}
                </p>
                <p className="text-sm text-slate-500">{reviewSummary.totalReviews} reviews</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Location</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{city}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Request mode</p>
                <p className="mt-2 text-sm font-medium text-slate-900">Direct vendor request</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Conversation</p>
                <p className="mt-2 text-sm font-medium text-slate-900">Message first, then call in chat</p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] bg-[linear-gradient(135deg,#f5fbf8_0%,#ffffff_100%)] p-4">
              <h2 className="text-lg font-semibold text-slate-950">What you can do next</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Send a direct request to this business.</p>
                <p>Open chat instantly and continue to in-app calling from the conversation screen.</p>
                <p>Track the request in your requests page after submission.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => void createRequest()}
                disabled={busyAction === "request" || busyAction === "location"}
                className="rounded-full bg-emerald-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {busyAction === "request" ? "Sending request..." : busyAction === "location" ? "Getting location..." : "Request service"}
              </button>
              <Link
                href={user ? messageHref : `/login?next=${encodeURIComponent(messageHref)}`}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700"
              >
                Message business
              </Link>
              <button
                onClick={() => void ensureLocation()}
                disabled={busyAction === "location"}
                className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                {busyAction === "location" ? "Connecting..." : lat != null && lng != null ? "Location connected" : "Connect location"}
              </button>
            </div>
          </div>
        </section>

        <StatusToast message={status} tone={tone} />
      </div>
    </AppShell>
  );
}
