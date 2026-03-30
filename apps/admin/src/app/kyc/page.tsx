"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [status, setStatus] = useState("Loading queue...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);

  const loadQueue = useCallback(async () => {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    setTone("info");
    const res = await apiGet<KycListResponse>("/admin/kyc/submissions");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setSubmissions(res.data.submissions);
    setTone("success");
    setStatus(`Loaded ${res.data.submissions.length} submission(s).`);
  }, [router]);

  useEffect(() => {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    const timer = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router, loadQueue]);

  async function approve(id: string) {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    setTone("info");
    const res = await apiPost<{ ok: boolean }>(`/admin/kyc/${id}/approve`, { note: "Approved by admin" });
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setTone("success");
    setStatus("Submission approved.");
    await loadQueue();
  }

  async function reject(id: string) {
    const session = requireRole(router, "ADMIN");
    if (!session) return;
    setTone("info");
    const res = await apiPost<{ ok: boolean }>(`/admin/kyc/${id}/reject`, { note: "Rejected - re-upload docs" });
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setTone("success");
    setStatus("Submission rejected.");
    await loadQueue();
  }

  return (
    <AppShell>
      <section className="bm-card bm-rise-1">
        <h2>KYC Queue</h2>
        <div className="bm-row">
          <button className="bm-btn bm-btn-primary" onClick={loadQueue}>Refresh queue</button>
        </div>
        <ul className="bm-list">
          {submissions.map((s) => (
            <li key={s.id}>
              <strong>{s.vendor.businessName ?? "Unnamed Vendor"}</strong> ({s.vendor.user.email ?? "no-email"}) | {s.status}
              <div className="bm-row" style={{ marginTop: 8 }}>
                <button className="bm-btn bm-btn-success" onClick={() => approve(s.id)}>Approve</button>
                <button className="bm-btn bm-btn-warn" onClick={() => reject(s.id)}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
        <StatusToast message={status} tone={tone} />
      </section>
    </AppShell>
  );
}
