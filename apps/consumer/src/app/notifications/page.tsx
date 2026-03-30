"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { requireRole } from "@/lib/route-guard";
import { markAllNotificationsRead, readNotifications, type AppNotification } from "@/lib/notifications";

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>(() => readNotifications());

  useEffect(() => {
    const session = requireRole(router, "CONSUMER");
    if (!session) return;
    const timer = window.setTimeout(() => {
      setItems(readNotifications());
      markAllNotificationsRead();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600 mt-1">Dispatch, payment, booking, and vendor location updates.</p>
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-700">No notifications yet.</div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{item.body}</p>
                    <p className="mt-2 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  {item.href && (
                    <Link className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" href={item.href}>
                      Open
                    </Link>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
