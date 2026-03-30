"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";
import { fetchWsToken, getRealtimeBase } from "@/lib/realtime";
import { pushNotification } from "@/lib/notifications";

type Offer = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  expiresAt: string;
  vendor: {
    id: string;
    businessName: string | null;
    city: string | null;
    user: {
      id: string;
      fullName: string | null;
      email: string | null;
      phone: string | null;
    };
  };
};

type RequestRow = {
  id: string;
  city: string;
  category: string;
  description: string;
  urgency: "normal" | "urgent";
  status: "CREATED" | "DISPATCHING" | "OFFERED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "EXPIRED";
  lat: number;
  lng: number;
  acceptedVendorId: string | null;
  createdAt: string;
  offers: Offer[];
};

type RequestsResponse = {
  ok: boolean;
  requests: RequestRow[];
};

type RequestUpdateResponse = {
  ok: boolean;
  request: RequestRow;
};

type WsPacket = {
  event: string;
  payload?: {
    request?: RequestRow;
    requestId?: string;
    vendorId?: string;
    lat?: number;
    lng?: number;
    updatedAt?: string;
  };
};

function statusTone(status: RequestRow["status"]) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "IN_PROGRESS" || status === "ACCEPTED") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (status === "CANCELED" || status === "EXPIRED") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function RequestsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Loading requests...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [vendorLocations, setVendorLocations] = useState<Record<string, { lat: number; lng: number; updatedAt: string }>>({});

  const activeRequests = useMemo(
    () => requests.filter((row) => !["COMPLETED", "CANCELED", "EXPIRED"].includes(row.status)),
    [requests],
  );
  const historyRequests = useMemo(
    () => requests.filter((row) => ["COMPLETED", "CANCELED", "EXPIRED"].includes(row.status)),
    [requests],
  );

  const mergeRequest = useCallback((next: RequestRow) => {
    setRequests((current) => {
      const found = current.some((row) => row.id === next.id);
      const merged = found
        ? current.map((row) => (row.id === next.id ? { ...row, ...next } : row))
        : [next, ...current];
      return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }, []);

  const loadRequests = useCallback(async () => {
    setTone("info");
    const res = await apiGet<RequestsResponse>("/requests/me");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setRequests(res.data.requests);
    setTone("success");
    setStatus(`Loaded ${res.data.requests.length} request(s).`);
  }, []);

  useEffect(() => {
    const session = requireRole(router, "CONSUMER");
    if (!session) return;
    const timer = window.setTimeout(() => {
      void loadRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router, loadRequests]);

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
            if (packet.event === "request_update" && packet.payload?.request) {
              mergeRequest(packet.payload.request);
              pushNotification({
                title: "Request Updated",
                body: `${packet.payload.request.category} is now ${packet.payload.request.status.replaceAll("_", " ").toLowerCase()}.`,
                href: "/requests",
              });
              return;
            }

            if (packet.event === "vendor:location" && packet.payload?.requestId) {
              if (typeof packet.payload.lat === "number" && typeof packet.payload.lng === "number" && packet.payload.updatedAt) {
                setVendorLocations((current) => ({
                  ...current,
                  [packet.payload!.requestId!]: {
                    lat: packet.payload!.lat!,
                    lng: packet.payload!.lng!,
                    updatedAt: packet.payload!.updatedAt!,
                  },
                }));
              }
              pushNotification({
                title: "Vendor Location Updated",
                body: `Your vendor updated location for request ${packet.payload.requestId}.`,
                href: "/requests",
              });
            }
          } catch {
            // ignore malformed packets
          }
        };
      } catch {
        // keep polling/manual refresh as fallback
      }
    }

    void connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, [mergeRequest]);

  async function cancelRequest(requestId: string) {
    setBusyId(requestId);
    setTone("info");
    setStatus("Canceling request...");
    const res = await apiPost<RequestUpdateResponse>(`/requests/${requestId}/cancel`, {});
    setBusyId(null);
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    mergeRequest(res.data.request);
    setTone("success");
    setStatus("Request canceled.");
  }

  function acceptedOffer(row: RequestRow) {
    return row.offers.find((offer) => offer.status === "ACCEPTED") ?? null;
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Track Requests</h1>
            <p className="text-gray-600 mt-1">Monitor dispatch, accepted vendors, live job progress, and request history.</p>
          </div>
          <button className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50" onClick={loadRequests}>
            Refresh
          </button>
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900">Active</h2>
          <div className="mt-3 space-y-4">
            {activeRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-gray-600">
                No active requests. Create one from the dashboard to start dispatching vendors.
              </div>
            ) : (
              activeRequests.map((row) => {
                const accepted = acceptedOffer(row);
                const vendorLocation = vendorLocations[row.id];
                return (
                  <article key={row.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">{row.category}</h3>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                            {row.status.replaceAll("_", " ")}
                          </span>
                          {row.urgency === "urgent" && (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{row.description}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {row.city} · {row.lat.toFixed(4)}, {row.lng.toFixed(4)} · {new Date(row.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {accepted && (
                          <Link
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                            href={`/messages?vendorId=${accepted.vendor.id}`}
                          >
                            Message Vendor
                          </Link>
                        )}
                        {!["COMPLETED", "CANCELED", "EXPIRED"].includes(row.status) && (
                          <button
                            disabled={busyId === row.id}
                            className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            onClick={() => cancelRequest(row.id)}
                          >
                            {busyId === row.id ? "Canceling..." : "Cancel"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">Dispatch progress</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {accepted
                            ? `Accepted by ${accepted.vendor.businessName ?? accepted.vendor.user.fullName ?? "Vendor"}.`
                            : row.offers.length
                              ? `${row.offers.length} vendor offer(s) sent so far.`
                              : "Waiting for the first eligible vendor."}
                        </p>
                        {vendorLocation && (
                          <p className="mt-2 text-xs text-slate-500">
                            Live vendor location: {vendorLocation.lat.toFixed(4)}, {vendorLocation.lng.toFixed(4)} · updated {new Date(vendorLocation.updatedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">Vendor offers</p>
                        {row.offers.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-600">No offers yet.</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {row.offers.slice(0, 3).map((offer) => (
                              <li key={offer.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                                <span className="font-medium text-slate-900">
                                  {offer.vendor.businessName ?? offer.vendor.user.fullName ?? "Vendor"}
                                </span>
                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(offer.status as RequestRow["status"])}`}>
                                  {offer.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          <div className="mt-3 space-y-3">
            {historyRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-gray-600">
                Completed, canceled, and expired requests will appear here.
              </div>
            ) : (
              historyRequests.map((row) => (
                <article key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{row.category}</p>
                      <p className="text-sm text-gray-600">{row.description}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
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
