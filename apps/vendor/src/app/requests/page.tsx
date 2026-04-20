"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { pushNotification } from "@/lib/notifications";
import { requireRole } from "@/lib/route-guard";

type VendorRequest = {
  id: string;
  city: string;
  category: string;
  description: string;
  urgency: "normal" | "urgent";
  status: "CREATED" | "DISPATCHING" | "OFFERED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "EXPIRED";
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
    };
  } | null;
};

function requestTone(status: VendorRequest["status"]) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "IN_PROGRESS" || status === "ACCEPTED") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (status === "CANCELED" || status === "EXPIRED") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function VendorRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [latestOffer, setLatestOffer] = useState<OfferResponse["offer"]>(null);
  const [status, setStatus] = useState("Loading requests...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busyAction, setBusyAction] = useState<null | "accept" | "decline" | `start:${string}` | `complete:${string}`>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const activeRequests = useMemo(
    () => requests.filter((row) => ["ACCEPTED", "IN_PROGRESS", "OFFERED", "DISPATCHING"].includes(row.status)),
    [requests],
  );

  const refresh = useCallback(async () => {
    setTone("info");
    setStatus("Refreshing requests...");
    const [requestsRes, offerRes] = await Promise.all([
      apiGet<VendorRequestsResponse>("/requests/vendor/mine"),
      apiGet<OfferResponse>("/requests/vendor/my-offer/latest"),
    ]);

    if (!requestsRes.ok || !requestsRes.data) {
      setTone("error");
      setStatus(`Failed: ${requestsRes.error}`);
      return;
    }

    setRequests(requestsRes.data.requests);
    setLatestOffer(offerRes.ok && offerRes.data ? offerRes.data.offer : null);
    setTone("success");
    setStatus("Requests updated.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await requireRole(router, "VENDOR");
      if (!session || cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function acceptOffer() {
    if (!latestOffer) return;
    setBusyAction("accept");
    setTone("info");
    setStatus("Accepting request...");
    const res = await apiPost<{ ok: boolean }>(`/requests/offers/${latestOffer.id}/accept`, {});
    setBusyAction(null);
    if (!res.ok) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }
    pushNotification({
      title: "Request accepted",
      body: `${latestOffer.request.category} has moved into your active jobs queue.`,
      href: "/requests",
    });
    await refresh();
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
      setStatus(`Failed: ${res.error}`);
      return;
    }
    pushNotification({
      title: "Request declined",
      body: `${latestOffer.request.category} was declined and removed from your pending queue.`,
      href: "/requests",
    });
    await refresh();
  }

  async function startJob(requestId: string) {
    setBusyAction(`start:${requestId}`);
    setTone("info");
    setStatus("Starting job...");
    const res = await apiPost<{ ok: boolean }>(`/requests/${requestId}/start`, {});
    setBusyAction(null);
    if (!res.ok) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }
    pushNotification({
      title: "Job started",
      body: "The request has moved into active delivery.",
      href: "/requests",
    });
    await refresh();
  }

  async function completeJob(requestId: string, category: string) {
    const rawAmount = amounts[requestId] ?? "";
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTone("error");
      setStatus("Enter the final agreed amount before completing this job.");
      return;
    }

    setBusyAction(`complete:${requestId}`);
    setTone("info");
    setStatus("Completing job and settling payment...");
    const res = await apiPost<{ ok: boolean }>(`/requests/${requestId}/complete`, { amount });
    setBusyAction(null);
    if (!res.ok) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }
    pushNotification({
      title: "Job completed",
      body: `${category} has been completed and payout recorded.`,
      href: "/wallet",
    });
    setAmounts((current) => ({ ...current, [requestId]: "" }));
    await refresh();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Requests</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Dispatch and job movement</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Handle new offers, active jobs, and the latest customer demand from one clean queue.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white" onClick={refresh}>
              Refresh
            </button>
            <Link href="/messages" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Open messages
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pending offer</p>
          {!latestOffer ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
              No pending dispatch offer right now.
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{latestOffer.request.category}</h2>
                {latestOffer.request.urgency === "urgent" ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    Urgent
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{latestOffer.request.description}</p>
              <p className="mt-2 text-sm text-slate-600">{latestOffer.request.city}</p>
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

        <section className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Live queue</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">{activeRequests.length} moving now</h2>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {requests.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                Requests will appear here once dispatch starts moving through your account.
              </div>
            ) : (
              requests.map((row) => (
                <article key={row.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">{row.category}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${requestTone(row.status)}`}>
                          {row.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{row.description}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {row.city} · {row.consumer.fullName ?? row.consumer.email ?? row.consumer.phone ?? "Unknown customer"}
                      </p>
                    </div>
                    <Link className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" href={`/messages?requestId=${row.id}`}>
                      Message
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {row.status === "ACCEPTED" ? (
                      <button
                        disabled={busyAction === `start:${row.id}`}
                        className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        onClick={() => void startJob(row.id)}
                      >
                        {busyAction === `start:${row.id}` ? "Starting..." : "Start job"}
                      </button>
                    ) : null}

                    {row.status === "IN_PROGRESS" ? (
                      <>
                        <input
                          inputMode="numeric"
                          type="number"
                          min="1"
                          placeholder="Final amount"
                          value={amounts[row.id] ?? ""}
                          onChange={(e) =>
                            setAmounts((current) => ({
                              ...current,
                              [row.id]: e.target.value,
                            }))
                          }
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none"
                        />
                        <button
                          disabled={busyAction === `complete:${row.id}`}
                          className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                          onClick={() => void completeJob(row.id, row.category)}
                        >
                          {busyAction === `complete:${row.id}` ? "Completing..." : "Complete job"}
                        </button>
                      </>
                    ) : null}
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
