"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { fetchWsToken, getRealtimeBase } from "@/lib/realtime";
import { pushNotification } from "@/lib/notifications";
import { readSession } from "@/lib/session";
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
  const user = readSession()?.user ?? null;
  const [vendor, setVendor] = useState<VendorMeResponse["vendor"] | null>(null);
  const [latestOffer, setLatestOffer] = useState<OfferResponse["offer"]>(null);
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [status, setStatus] = useState("Loading dashboard...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [completionAmounts, setCompletionAmounts] = useState<Record<string, number>>({});

  const activeJobs = useMemo(
    () => requests.filter((row) => ["ACCEPTED", "IN_PROGRESS"].includes(row.status)),
    [requests],
  );

  const offerHistory = useMemo(
    () => requests.filter((row) => row.offers.length > 0),
    [requests],
  );

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

  const refreshAll = useCallback(async () => {
    setTone("info");
    setStatus("Refreshing vendor operations...");
    await Promise.all([refreshVendor(), refreshOffer(), refreshRequests()]);
    setTone("success");
    setStatus("Vendor operations ready.");
  }, [refreshOffer, refreshRequests, refreshVendor]);

  useEffect(() => {
    const session = requireRole(router, "VENDOR");
    if (!session) return;
    const timer = window.setTimeout(() => {
      void refreshAll();
    }, 0);
    return () => window.clearTimeout(timer);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
          <p className="text-gray-600 mt-1">Accept nearby jobs, manage active work, and keep your dispatch location current.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Account</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{user?.email ?? user?.phone}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Business</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{vendor?.businessName ?? "Not set"}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">KYC Status</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{vendor?.kycStatus ?? "-"}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Location</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {vendor?.lat != null && vendor?.lng != null ? `${vendor.lat.toFixed(4)}, ${vendor.lng.toFixed(4)}` : "Not synced"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="px-5 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold" onClick={refreshAll}>Refresh</button>
          <button className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={syncMyLocation}>
            Sync My Location
          </button>
          <Link className="px-5 py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-semibold" href="/kyc">Manage KYC</Link>
          <Link className="px-5 py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-semibold" href="/services">Manage Services</Link>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Live Offer Queue</h2>
              <p className="text-sm text-gray-600 mt-1">Newest dispatch offer sent to your account.</p>
            </div>
            {latestOffer && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Expires {new Date(latestOffer.expiresAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {!latestOffer ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-gray-600">
              No pending offer right now.
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{latestOffer.request.category}</h3>
                {latestOffer.request.urgency === "urgent" && (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    Urgent
                  </span>
                )}
              </div>
              <p className="mt-2 text-gray-700">{latestOffer.request.description}</p>
              <p className="mt-2 text-sm text-gray-600">
                {latestOffer.request.city} · {latestOffer.request.lat.toFixed(4)}, {latestOffer.request.lng.toFixed(4)}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={busyAction === "accept"}
                  className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  onClick={acceptOffer}
                >
                  {busyAction === "accept" ? "Accepting..." : "Accept"}
                </button>
                <button
                  disabled={busyAction === "decline"}
                  className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-white disabled:opacity-60"
                  onClick={declineOffer}
                >
                  {busyAction === "decline" ? "Declining..." : "Decline"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-gray-900">Active Jobs</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {activeJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-gray-600">
                Accepted and in-progress jobs will show here.
              </div>
            ) : (
              activeJobs.map((job) => (
                <article key={job.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{job.category}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${requestTone(job.status)}`}>
                          {job.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{job.description}</p>
                      <p className="mt-2 text-sm text-gray-700">
                        Customer: {job.consumer.fullName ?? job.consumer.email ?? job.consumer.phone ?? "Unknown"}
                      </p>
                    </div>
                    <Link className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" href={`/messages?requestId=${job.id}`}>
                      Chat
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {job.status === "ACCEPTED" && (
                      <button
                        disabled={busyAction === `start:${job.id}`}
                        className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        onClick={() => updateJob(job.id, "start")}
                      >
                        {busyAction === `start:${job.id}` ? "Starting..." : "Start Job"}
                      </button>
                    )}
                    {job.status === "IN_PROGRESS" && (
                      <>
                        <input
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm"
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
                          className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          onClick={() => updateJob(job.id, "complete")}
                        >
                          {busyAction === `complete:${job.id}` ? "Completing..." : "Complete Job"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-gray-900">Offer History</h2>
          <div className="mt-4 space-y-3">
            {offerHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-gray-600">
                Offer history will appear after dispatches begin reaching your account.
              </div>
            ) : (
              offerHistory.map((row) => (
                <article key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{row.category}</p>
                      <p className="text-sm text-gray-600">{row.description}</p>
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
