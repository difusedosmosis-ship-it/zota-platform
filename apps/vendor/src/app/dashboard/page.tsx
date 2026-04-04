"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { fetchWsToken, getRealtimeBase } from "@/lib/realtime";
import { pushNotification } from "@/lib/notifications";
import { readSession, type SessionUser } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type VendorMeResponse = {
  ok: boolean;
  vendor: {
    id: string;
    businessName: string | null;
    city: string | null;
    coverageKm: number;
    isOnline: boolean;
    kycStatus: string;
    lat: number | null;
    lng: number | null;
  };
};

type OfferResponse = {
  ok: boolean;
  offer: {
    id: string;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
    expiresAt: string;
    request: {
      id: string;
      city: string;
      category: string;
      description: string;
      urgency: string;
      lat: number;
      lng: number;
    };
  } | null;
};

type VendorRequest = {
  id: string;
  city: string;
  category: string;
  description: string;
  urgency: "normal" | "urgent";
  status: "CREATED" | "DISPATCHING" | "OFFERED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "EXPIRED";
  lat: number;
  lng: number;
  createdAt: string;
  consumer: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
  };
  offers: Array<{
    id: string;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
    expiresAt: string;
    createdAt: string;
  }>;
};

type VendorRequestsResponse = {
  ok: boolean;
  requests: VendorRequest[];
};

type RequestUpdateResponse = {
  ok: boolean;
  request: VendorRequest;
};

type ServicesResponse = {
  ok: boolean;
  services: Array<{
    id: string;
    isActive?: boolean;
  }>;
};

type BookingListingsResponse = {
  ok: boolean;
  listings: Array<{
    id: string;
    isActive: boolean;
  }>;
};

type WalletSummaryResponse = {
  ok: boolean;
  summary: {
    balance: number;
    credits: number;
    debits: number;
    rows: number;
  };
};

type WsPacket = {
  event: string;
  payload?: {
    offer?: OfferResponse["offer"];
    request?: VendorRequest;
  };
};

function requestTone(status: VendorRequest["status"]) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "IN_PROGRESS" || status === "ACCEPTED") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (status === "CANCELED" || status === "EXPIRED") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [vendor, setVendor] = useState<VendorMeResponse["vendor"] | null>(null);
  const [latestOffer, setLatestOffer] = useState<OfferResponse["offer"]>(null);
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [status, setStatus] = useState("Loading dashboard...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [completionAmounts, setCompletionAmounts] = useState<Record<string, number>>({});
  const [serviceCount, setServiceCount] = useState(0);
  const [activeServiceCount, setActiveServiceCount] = useState(0);
  const [bookingListingCount, setBookingListingCount] = useState(0);
  const [walletSummary, setWalletSummary] = useState<WalletSummaryResponse["summary"] | null>(null);
  const [locationSyncedOnce, setLocationSyncedOnce] = useState(false);

  const activeJobs = useMemo(
    () => requests.filter((row) => ["ACCEPTED", "IN_PROGRESS"].includes(row.status)),
    [requests],
  );

  const offerHistory = useMemo(
    () => requests.filter((row) => row.offers.length > 0),
    [requests],
  );
  const locationReady = vendor?.lat != null && vendor?.lng != null;
  const completedJobs = useMemo(
    () => requests.filter((row) => row.status === "COMPLETED"),
    [requests],
  );
  const requestPipelineCount = latestOffer ? activeJobs.length + 1 : activeJobs.length;

  const mergeRequest = useCallback((next: VendorRequest) => {
    setRequests((current) => {
      const found = current.some((row) => row.id === next.id);
      const merged = found
        ? current.map((row) => (row.id === next.id ? { ...row, ...next } : row))
        : [next, ...current];
      return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }, []);

  const refreshVendor = useCallback(async () => {
    const res = await apiGet<VendorMeResponse>("/vendor/me");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setVendor(res.data.vendor);
  }, []);

  const refreshOffer = useCallback(async () => {
    const res = await apiGet<OfferResponse>("/requests/vendor/my-offer/latest");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setLatestOffer(res.data.offer);
  }, []);

  const refreshRequests = useCallback(async () => {
    const res = await apiGet<VendorRequestsResponse>("/requests/vendor/mine");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setRequests(res.data.requests);
  }, []);

  const refreshCatalog = useCallback(async () => {
    const [servicesRes, listingsRes] = await Promise.all([
      apiGet<ServicesResponse>("/vendor/services"),
      apiGet<BookingListingsResponse>("/booking/vendor/listings"),
    ]);

    if (servicesRes.ok && servicesRes.data) {
      setServiceCount(servicesRes.data.services.length);
      setActiveServiceCount(servicesRes.data.services.filter((row) => row.isActive !== false).length);
    }

    if (listingsRes.ok && listingsRes.data) {
      setBookingListingCount(listingsRes.data.listings.filter((row) => row.isActive).length);
    }
  }, []);

  const refreshFinance = useCallback(async () => {
    const res = await apiGet<WalletSummaryResponse>("/wallet/me/summary");
    if (res.ok && res.data) {
      setWalletSummary(res.data.summary);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setTone("info");
    setStatus("Refreshing business operations...");
    await Promise.all([refreshVendor(), refreshOffer(), refreshRequests(), refreshCatalog(), refreshFinance()]);
    setTone("success");
    setStatus("Business control room ready.");
  }, [refreshCatalog, refreshFinance, refreshOffer, refreshRequests, refreshVendor]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "VENDOR");
        if (!session || cancelled) return;
        setUser(session.user);
        await refreshAll();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, refreshAll]);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;

    async function connect() {
      try {
        const token = await fetchWsToken();
        if (closed) return;
        socket = new WebSocket(`${getRealtimeBase()}/ws?token=${encodeURIComponent(token)}`);
        socket.onmessage = (event) => {
          try {
            const packet = JSON.parse(event.data) as WsPacket;
            if (packet.event === "offer" && packet.payload?.offer) {
              setLatestOffer(packet.payload.offer);
              pushNotification({
                title: "New Dispatch Offer",
                body: `${packet.payload.offer.request.category} request is waiting for your response.`,
                href: "/dashboard",
              });
            }
            if (packet.event === "request_update" && packet.payload?.request) {
              mergeRequest(packet.payload.request);
              pushNotification({
                title: "Job Updated",
                body: `${packet.payload.request.category} is now ${packet.payload.request.status.replaceAll("_", " ").toLowerCase()}.`,
                href: "/dashboard",
              });
              if (latestOffer?.request.id === packet.payload.request.id) {
                void refreshOffer();
              }
            }
          } catch {
            // ignore malformed packets
          }
        };
      } catch {
        // polling/manual refresh remains available
      }
    }

    void connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, [latestOffer?.request.id, mergeRequest, refreshOffer]);

  async function syncMyLocation() {
    if (!navigator.geolocation) {
      setTone("error");
      return setStatus("Geolocation is not supported on this device.");
    }

    setTone("info");
    setStatus("Getting your live location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const res = await apiPatch<{ ok: boolean }>("/vendor/me/location", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        if (!res.ok) {
          setTone("error");
          return setStatus(`Failed: ${res.error}`);
        }
        setTone("success");
        setStatus("Vendor location synced.");
        setLocationSyncedOnce(true);
        await refreshVendor();
      },
      () => {
        setTone("error");
        setStatus("Could not detect vendor location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function acceptOffer() {
    if (!latestOffer) return;
    setBusyAction("accept");
    setTone("info");
    setStatus("Accepting request...");
    const res = await apiPost<RequestUpdateResponse>(`/requests/offers/${latestOffer.id}/accept`, {});
    setBusyAction(null);
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    mergeRequest(res.data.request);
    setLatestOffer(null);
    setTone("success");
    setStatus("Request accepted.");
  }

  async function declineOffer() {
    if (!latestOffer) return;
    setBusyAction("decline");
    setTone("info");
    setStatus("Declining request...");
    const res = await apiPost<{ ok: boolean }>(`/requests/offers/${latestOffer.id}/decline`, {});
    setBusyAction(null);
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setLatestOffer(null);
    setTone("success");
    setStatus("Offer declined.");
    await refreshRequests();
  }

  async function updateJob(requestId: string, action: "start" | "complete") {
    setBusyAction(`${action}:${requestId}`);
    setTone("info");
    setStatus(action === "start" ? "Starting job..." : "Completing job...");
    const res = await apiPost<RequestUpdateResponse>(`/requests/${requestId}/${action}`, {
      amount: action === "complete" ? completionAmounts[requestId] : undefined,
    });
    setBusyAction(null);
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    mergeRequest(res.data.request);
    setTone("success");
    setStatus(action === "start" ? "Job started." : "Job completed.");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_36%),linear-gradient(145deg,#0f172a_0%,#13253f_42%,#052e2b_100%)] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100">Zota Business</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
            Business control room
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
            {user?.email ?? user?.phone}
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <article className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Profile</p>
              <p className="mt-2 text-lg font-bold text-white">{vendor?.businessName ? "Ready" : "Needs setup"}</p>
              <p className="mt-2 text-xs text-slate-300">{vendor?.businessName ?? "Add business details in Account."}</p>
            </article>
            <article className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Verification</p>
              <p className="mt-2 text-lg font-bold text-white">{vendor?.kycStatus === "APPROVED" ? "Approved" : "Pending"}</p>
              <p className="mt-2 text-xs text-slate-300">{vendor?.kycStatus === "APPROVED" ? "Customers can trust this business." : "Finish account verification."}</p>
            </article>
            <article className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Catalog</p>
              <p className="mt-2 text-lg font-bold text-white">{activeServiceCount + bookingListingCount} live</p>
              <p className="mt-2 text-xs text-slate-300">{activeServiceCount} services · {bookingListingCount} bookings</p>
            </article>
            <article className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Wallet</p>
              <p className="mt-2 text-lg font-bold text-white">NGN {walletSummary?.balance.toLocaleString() ?? "0"}</p>
              <p className="mt-2 text-xs text-slate-300">{vendor?.isOnline ? "Online for requests" : "Offline"}</p>
            </article>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {!locationReady && !locationSyncedOnce ? (
              <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900" onClick={syncMyLocation}>
                Sync location
              </button>
            ) : (
              <span className="rounded-2xl bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-50">
                Location synced
              </span>
            )}
            <button className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white" onClick={refreshAll}>
              Refresh
            </button>
            <Link className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white" href="/services">
              Catalog
            </Link>
            <Link className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white" href="/messages">
              Inbox
            </Link>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Trust</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-900">{vendor?.kycStatus === "APPROVED" ? "Approved" : "Complete verification"}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {vendor?.kycStatus !== "APPROVED" ? (
                <Link href="/account" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                  Open account
                </Link>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Verified</span>
              )}
            </div>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Catalog</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-900">{serviceCount + bookingListingCount} published items</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/services" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                Open catalog
              </Link>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{activeServiceCount} live services</span>
            </div>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Requests</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-900">{requestPipelineCount} request{requestPipelineCount === 1 ? "" : "s"} moving now</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/messages" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                Open inbox
              </Link>
              <Link href="/wallet" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                Earnings
              </Link>
            </div>
          </article>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Performance snapshot</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">What the business is doing right now</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active jobs</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{activeJobs.length}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Completed jobs</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{completedJobs.length}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wallet credits</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">NGN {walletSummary?.credits.toLocaleString() ?? "0"}</p>
              </div>
              <div className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wallet debits</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">NGN {walletSummary?.debits.toLocaleString() ?? "0"}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Business path</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">Core flow</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-[22px] border border-slate-200 p-4">
                <p className="font-semibold text-slate-950">1. Verify</p>
                <p className="mt-1">Set up the business and pass trust checks.</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 p-4">
                <p className="font-semibold text-slate-950">2. Publish</p>
                <p className="mt-1">List services and booking assets customers can find.</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 p-4">
                <p className="font-semibold text-slate-950">3. Deliver</p>
                <p className="mt-1">Take requests, complete jobs, and track earnings.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Incoming requests</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">Respond fast, then move into delivery.</h2>
            </div>
            {latestOffer && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Expires {new Date(latestOffer.expiresAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {!latestOffer ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
              No pending offer at the moment. Refresh or keep the inbox open while dispatch is active.
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{latestOffer.request.category}</h3>
                {latestOffer.request.urgency === "urgent" && (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    Urgent
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{latestOffer.request.description}</p>
              <p className="mt-2 text-sm text-slate-600">{latestOffer.request.city} · ready for dispatch</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={busyAction === "accept"}
                  className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={acceptOffer}
                >
                  {busyAction === "accept" ? "Accepting..." : "Accept request"}
                </button>
                <button
                  disabled={busyAction === "decline"}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  onClick={declineOffer}
                >
                  {busyAction === "decline" ? "Declining..." : "Decline"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Active jobs</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">Current workstream</h2>
            </div>
            <Link href="/messages" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              Open inbox
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {activeJobs.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                Accepted and in-progress jobs will appear here once a request is assigned to you.
              </div>
            ) : (
              activeJobs.map((job) => (
                <article key={job.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{job.category}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${requestTone(job.status)}`}>
                          {job.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{job.description}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        Customer: {job.consumer.fullName ?? job.consumer.email ?? job.consumer.phone ?? "Unknown"}
                      </p>
                    </div>
                    <Link className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" href={`/messages?requestId=${job.id}`}>
                      Chat & call
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {job.status === "ACCEPTED" && (
                      <button
                        disabled={busyAction === `start:${job.id}`}
                        className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        onClick={() => updateJob(job.id, "start")}
                      >
                        {busyAction === `start:${job.id}` ? "Starting..." : "Start job"}
                      </button>
                    )}
                    {job.status === "IN_PROGRESS" && (
                      <>
                        <input
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none"
                          type="number"
                          min={0}
                          step={100}
                          placeholder="Final amount (NGN)"
                          value={completionAmounts[job.id] ?? ""}
                          onChange={(e) =>
                            setCompletionAmounts((current) => ({
                              ...current,
                              [job.id]: Number(e.target.value),
                            }))
                          }
                        />
                        <button
                          disabled={busyAction === `complete:${job.id}`}
                          className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                          onClick={() => updateJob(job.id, "complete")}
                        >
                          {busyAction === `complete:${job.id}` ? "Completing..." : "Complete job"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recent movement</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">Offer and request history</h2>
          <div className="mt-4 space-y-3">
            {offerHistory.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                Offer history will appear once dispatches start moving through your account.
              </div>
            ) : (
              offerHistory.map((row) => (
                <article key={row.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{row.category}</p>
                      <p className="text-sm text-slate-600">{row.description}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${requestTone(row.status)}`}>
                      {row.status.replaceAll("_", " ")}
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
