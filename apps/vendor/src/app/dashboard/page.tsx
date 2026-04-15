"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { apiGet } from "@/lib/api";
import { fetchWsToken, getRealtimeBase } from "@/lib/realtime";
import { pushNotification } from "@/lib/notifications";
import { readSession, type SessionUser } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";
import { OnboardingTour } from "@/components/OnboardingTour";

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

function humanizeStatus(status: string | null | undefined) {
  if (!status) return "Pending";
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

function greetingForHour() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDisplayName(user: SessionUser | null) {
  const seed = user?.email?.split("@")[0] ?? user?.phone ?? "there";
  return seed
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(amount: number | undefined) {
  return `NGN ${(amount ?? 0).toLocaleString()}`;
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [vendor, setVendor] = useState<VendorMeResponse["vendor"] | null>(null);
  const [latestOffer, setLatestOffer] = useState<OfferResponse["offer"]>(null);
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [serviceCount, setServiceCount] = useState(0);
  const [activeServiceCount, setActiveServiceCount] = useState(0);
  const [bookingListingCount, setBookingListingCount] = useState(0);
  const [walletSummary, setWalletSummary] = useState<WalletSummaryResponse["summary"] | null>(null);

  const activeJobs = useMemo(
    () => requests.filter((row) => ["ACCEPTED", "IN_PROGRESS"].includes(row.status)),
    [requests],
  );
  const completedJobs = useMemo(
    () => requests.filter((row) => row.status === "COMPLETED"),
    [requests],
  );
  const recentMovement = useMemo(
    () => [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4),
    [requests],
  );

  const requestDashboard = useMemo(() => {
    const liveRequests = latestOffer ? activeJobs.length + 1 : activeJobs.length;
    const totalRequests = requests.length + (latestOffer ? 1 : 0);
    return {
      totalRequests,
      liveRequests,
      completed: completedJobs.length,
      pendingOffers: latestOffer ? 1 : 0,
    };
  }, [activeJobs.length, completedJobs.length, latestOffer, requests.length]);

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
    if (res.ok && res.data) {
      setVendor(res.data.vendor);
    }
  }, []);

  const refreshOffer = useCallback(async () => {
    const res = await apiGet<OfferResponse>("/requests/vendor/my-offer/latest");
    if (res.ok && res.data) {
      setLatestOffer(res.data.offer);
    }
  }, []);

  const refreshRequests = useCallback(async () => {
    const res = await apiGet<VendorRequestsResponse>("/requests/vendor/mine");
    if (res.ok && res.data) {
      setRequests(res.data.requests);
    }
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
    await Promise.all([refreshVendor(), refreshOffer(), refreshRequests(), refreshCatalog(), refreshFinance()]);
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
  }, [refreshAll, router]);

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
                href: "/requests",
              });
            }
            if (packet.event === "request_update" && packet.payload?.request) {
              mergeRequest(packet.payload.request);
              pushNotification({
                title: "Job Updated",
                body: `${packet.payload.request.category} is now ${packet.payload.request.status.replaceAll("_", " ").toLowerCase()}.`,
                href: "/requests",
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
        // manual refresh remains available
      }
    }

    void connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, [latestOffer?.request.id, mergeRequest, refreshOffer]);

  const businessLabel = formatDisplayName(user);
  const referenceNumber = vendor ? `ZB-${vendor.id.slice(-8).toUpperCase()}` : "Pending";
  const verificationLabel = humanizeStatus(vendor?.kycStatus);
  const businessStatus = vendor?.isOnline ? "Open for business" : "Closed for requests";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-5 text-slate-950 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-500">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-[1.05rem] font-medium tracking-[-0.02em] text-slate-700 sm:text-[1.15rem]">
                {greetingForHour()},{" "}
                <span className="text-emerald-700">{businessLabel}</span>
              </h1>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(145deg,#050816_0%,#0b1220_52%,#111827_100%)] p-6 text-white shadow-[0_18px_40px_rgba(8,15,34,0.3)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l7-4 7 4v14" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Business</p>
                <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-white">
                  {vendor?.businessName || "Business setup pending"}
                </p>
              </div>
            </div>

            <div className="mt-5 inline-flex rounded-full bg-white/14 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              Ref No: {referenceNumber}
            </div>

            <div className="mt-5 grid gap-3 text-sm text-emerald-50 md:grid-cols-2">
              <p>
                <span className="font-semibold text-white">Verification:</span> {verificationLabel}
              </p>
              <p>
                <span className="font-semibold text-white">Status:</span> {businessStatus}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Performance snapshot</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Business and request dashboard</h2>
            </div>
            <Link href="/wallet" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Wallet
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Total requests</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{requestDashboard.totalRequests}</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Live requests</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{requestDashboard.liveRequests}</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pending offers</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{requestDashboard.pendingOffers}</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Completed jobs</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{requestDashboard.completed}</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wallet balance</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{formatCurrency(walletSummary?.balance)}</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Credits</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{formatCurrency(walletSummary?.credits)}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Catalog</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Published services and assets</h2>
            </div>
            <Link href="/services" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
              Manage catalog
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Live services</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{activeServiceCount}</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Assets</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{bookingListingCount}</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Total catalog</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{serviceCount + bookingListingCount}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recent movement</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Latest activity across the business</h2>
            </div>
            <Link href="/requests" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Open requests
            </Link>
          </div>

          {recentMovement.length === 0 ? (
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No business movement yet. Requests and jobs will appear here as soon as customers start engaging the catalog.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {recentMovement.map((item) => (
                <article key={item.id} className="rounded-[22px] border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.category}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.city} · {item.consumer.fullName || item.consumer.email || item.consumer.phone || "Customer"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {humanizeStatus(item.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <OnboardingTour />
    </AppShell>
  );
}
