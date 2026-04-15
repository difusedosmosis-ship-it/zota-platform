"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type KycSubmission = {
  id: string;
  status: string;
  reviewerNote: string | null;
  vendor: { businessName: string | null; user: { email: string | null } };
};
type KycListResponse = { ok: boolean; submissions: KycSubmission[] };

export default function AdminKycPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setTone("info");
    const res = await apiGet<KycListResponse>("/admin/kyc/submissions");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to load verification queue.");
    }
    setSubmissions(res.data.submissions);
    setTone("success");
    setStatus(`Loaded ${res.data.submissions.length} submission(s).`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        await loadQueue();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadQueue, router]);

  async function approve(id: string) {
    setBusyId(`approve:${id}`);
    setTone("info");
    const res = await apiPost<{ ok: boolean }>(`/admin/kyc/${id}/approve`, { note: "Approved by Zota Office" });
    setBusyId(null);
    if (!res.ok) {
      setTone("error");
      return setStatus(res.error ?? "Failed to approve submission.");
    }
    setTone("success");
    setStatus("Submission approved.");
    await loadQueue();
  }

  async function reject(id: string) {
    setBusyId(`reject:${id}`);
    setTone("info");
    const res = await apiPost<{ ok: boolean }>(`/admin/kyc/${id}/reject`, { note: "Rejected - re-upload required documents" });
    setBusyId(null);
    if (!res.ok) {
      setTone("error");
      return setStatus(res.error ?? "Failed to reject submission.");
    }
    setTone("success");
    setStatus("Submission rejected.");
    await loadQueue();
  }

  const grouped = useMemo(
    () => ({
      pending: submissions.filter((s) => s.status === "PENDING" || s.status === "UNDER_REVIEW"),
      reviewed: submissions.filter((s) => s.status !== "PENDING" && s.status !== "UNDER_REVIEW"),
    }),
    [submissions],
  );

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Verification Desk</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Review businesses before they go live</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                This queue is the trust gate for Zota Business. Review pending submissions, approve compliant businesses, and reject incomplete documentation.
              </p>
            </div>
            <button className="bm-btn bm-btn-primary" onClick={loadQueue}>Refresh queue</button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Needs action</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{grouped.pending.length}</p>
            <p className="mt-2 text-sm text-slate-500">Submissions waiting for review.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Reviewed</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{grouped.reviewed.length}</p>
            <p className="mt-2 text-sm text-slate-500">Approved and rejected records already processed.</p>
          </article>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pending queue</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Businesses waiting for office approval</h3>
          <div className="mt-4 space-y-3">
            {grouped.pending.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                No pending KYC submissions right now.
              </div>
            ) : (
              grouped.pending.map((s) => (
                <article key={s.id} className="rounded-[24px] border border-slate-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{s.vendor.businessName ?? "Unnamed business"}</p>
                      <p className="mt-1 text-sm text-slate-500">{s.vendor.user.email ?? "no-email"}</p>
                      <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{s.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="bm-btn bm-btn-success" disabled={busyId === `approve:${s.id}`} onClick={() => approve(s.id)}>
                        {busyId === `approve:${s.id}` ? "Approving..." : "Approve"}
                      </button>
                      <button className="bm-btn bm-btn-warn" disabled={busyId === `reject:${s.id}`} onClick={() => reject(s.id)}>
                        {busyId === `reject:${s.id}` ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Reviewed history</p>
          <div className="mt-4 space-y-3">
            {grouped.reviewed.length === 0 ? (
              <p className="text-sm text-slate-500">No reviewed submissions yet.</p>
            ) : (
              grouped.reviewed.map((s) => (
                <article key={s.id} className="rounded-[20px] border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{s.vendor.businessName ?? "Unnamed business"}</p>
                      <p className="mt-1 text-sm text-slate-500">{s.vendor.user.email ?? "no-email"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{s.status}</p>
                      {s.reviewerNote ? <p className="mt-1 text-xs text-slate-400">{s.reviewerNote}</p> : null}
                    </div>
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
