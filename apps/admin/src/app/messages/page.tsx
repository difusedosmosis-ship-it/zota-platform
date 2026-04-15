"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type Conversation = {
  id: string;
  kind: string;
  lastMessageAt: string;
  consumer: { fullName: string | null; email: string | null; phone: string | null };
  vendorUser: { fullName: string | null; email: string | null; phone: string | null };
  vendor: { businessName: string | null; city: string | null; kycStatus: string | null } | null;
  service: { title: string; category: { name: string } } | null;
  request: { id: string; category: string; city: string; status: string } | null;
  messages: Array<{ body: string; createdAt: string; senderRole: string }>;
};

type CommunicationsResponse = { ok: boolean; conversations: Conversation[] };

export default function AdminMessagesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const loadCommunications = useCallback(async () => {
    const res = await apiGet<CommunicationsResponse>("/admin/communications");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to load communications.");
    }
    setConversations(res.data.conversations);
    setTone("success");
    setStatus(`Loaded ${res.data.conversations.length} conversation(s).`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        await loadCommunications();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadCommunications, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadCommunications();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadCommunications]);

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Communications</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Monitor consumer and business conversations</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                This office view shows recent marketplace conversations, the related request or service context, and the latest message moving through the system.
              </p>
            </div>
            <button className="bm-btn bm-btn-primary" onClick={loadCommunications}>Refresh</button>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="space-y-3">
            {conversations.length === 0 ? (
              <p className="text-sm text-slate-500">No conversations loaded yet.</p>
            ) : (
              conversations.map((row) => {
                const latest = row.messages[0];
                return (
                  <article key={row.id} className="rounded-[24px] border border-slate-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{row.vendor?.businessName ?? "Vendor conversation"}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {row.consumer.fullName ?? row.consumer.email ?? row.consumer.phone ?? "Consumer"} ↔ {row.vendorUser.fullName ?? row.vendorUser.email ?? row.vendorUser.phone ?? "Vendor user"}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {row.request ? `${row.request.category} · ${row.request.status}` : row.service ? `${row.service.category.name} · ${row.service.title}` : row.kind}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">{new Date(row.lastMessageAt).toLocaleString()}</p>
                    </div>
                    {latest ? (
                      <div className="mt-4 rounded-[18px] bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest message</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{latest.body}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
