"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type BookingOrder = {
  id: string;
  kind: "HOTEL" | "CAR" | "HALL" | "FLIGHT";
  status: string;
  amount: number;
  currency: string;
  startAt: string;
  endAt: string;
  listing: {
    id: string;
    title: string;
    city: string | null;
  } | null;
};

type OrdersResponse = {
  ok: boolean;
  orders: BookingOrder[];
};

type Listing = {
  id: string;
  kind: string;
  title: string;
  city: string | null;
  currency: string;
  pricePerDay: number;
};

type ListingsResponse = {
  ok: boolean;
  listings: Listing[];
};

export default function BookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Loading bookings...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [discover, setDiscover] = useState<Listing[]>([]);

  const loadBookings = useCallback(async () => {
    setTone("info");
    const [ordersRes, listingsRes] = await Promise.all([
      apiGet<OrdersResponse>("/booking/orders/me"),
      apiGet<ListingsResponse>("/booking/public/listings?city=Lagos&limit=8"),
    ]);

    if (!ordersRes.ok || !ordersRes.data) {
      setTone("error");
      return setStatus(`Failed: ${ordersRes.error}`);
    }

    setOrders(ordersRes.data.orders);
    if (listingsRes.ok && listingsRes.data) setDiscover(listingsRes.data.listings);
    setTone("success");
    setStatus("Bookings loaded.");
  }, []);

  useEffect(() => {
    const session = requireRole(router, "CONSUMER");
    if (!session) return;
    const timer = window.setTimeout(() => {
      void loadBookings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router, loadBookings]);

  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference) return;

    const timer = window.setTimeout(async () => {
      setTone("info");
      setStatus("Verifying booking payment...");
      const res = await apiPost<{ ok: boolean }>("/payments/verify", { reference });
      if (!res.ok) {
        setTone("error");
        setStatus(`Failed: ${res.error}`);
        return;
      }
      await loadBookings();
      setTone("success");
      setStatus("Booking payment verified.");
      router.replace("/bookings");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams, loadBookings, router]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
            <p className="text-gray-600 mt-1">Upcoming orders, past reservations, and recommended inventory.</p>
          </div>
          <button className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50" onClick={loadBookings}>
            Refresh
          </button>
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">My Orders</h2>
          <div className="mt-4 space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-gray-600">No booking orders yet. Booking quotes and confirmations will appear here.</p>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{order.listing?.title ?? `${order.kind} booking`}</p>
                      <p className="text-sm text-gray-600">{order.listing?.city ?? "-"} · {new Date(order.startAt).toLocaleDateString()} - {new Date(order.endAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{order.currency} {order.amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{order.status}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Discover Inventory</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {discover.map((listing) => (
              <article key={listing.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{listing.kind}</p>
                <p className="mt-2 font-semibold text-gray-900">{listing.title}</p>
                <p className="mt-1 text-sm text-gray-600">{listing.city ?? "-"}</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">{listing.currency} {listing.pricePerDay.toLocaleString()}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
