"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  href: string;
  status: string;
};

type NotificationsResponse = { ok: boolean; notifications: NotificationItem[] };

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = useCallback(async () => {
    const res = await apiGet<NotificationsResponse>("/admin/notifications");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to load notifications.");
    }
    setNotifications(res.data.notifications);
    setTone("success");
    setStatus(`Loaded ${res.data.notifications.length} notification(s).`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        await loadNotifications();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadNotifications, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Notifications</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Live office activity and approval alerts</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                New KYC submissions and request-state changes flow here so the office can react quickly.
              </p>
            </div>
            <button className="bm-btn bm-btn-primary" onClick={loadNotifications}>Refresh</button>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No office notifications loaded yet.</p>
            ) : (
              notifications.map((item) => (
                <Link key={item.id} href={item.href} className="block rounded-[24px] border border-slate-200 p-5 transition hover:bg-slate-50">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                      <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">{item.status}</p>
                    </div>
                    <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
