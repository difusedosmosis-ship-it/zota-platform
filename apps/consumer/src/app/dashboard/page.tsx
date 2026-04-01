"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { readSession } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type Category = { id: string; name: string; kind: string };

type CategoriesResponse = {
  ok: boolean;
  categories: Category[];
};

type NearbyVendor = {
  id: string;
  businessName: string | null;
  city: string | null;
  coverageKm: number;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
  distanceKm: number;
};

type NearbyResponse = {
  ok: boolean;
  vendors: NearbyVendor[];
};

type VendorReviewsResponse = {
  ok: boolean;
  summary: {
    averageRating: number;
    totalReviews: number;
  };
};

type RequestCreateResponse = {
  ok: boolean;
  id: string;
};

type BookingSearchListing = {
  id: string;
  kind: "HOTEL" | "CAR" | "HALL" | "FLIGHT";
  title: string;
  city?: string | null;
  currency: string;
  pricePerDay: number;
  isActive: boolean;
};

type BookingSearchResponse = {
  ok: boolean;
  provider: string;
  listings: BookingSearchListing[];
};

type BookingQuoteResponse = {
  ok: boolean;
  quote: {
    id: string;
    amount: number;
    currency: string;
  };
};

type BookingCheckoutResponse = {
  ok: boolean;
  order?: {
    id: string;
    status: string;
  };
  payment?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export default function ConsumerDashboardPage() {
  const router = useRouter();
  const user = readSession()?.user ?? null;
  const [status, setStatus] = useState("Loading dashboard...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [city, setCity] = useState("Lagos");
  const [issue, setIssue] = useState("My car broke down and I need urgent mechanic support.");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("urgent");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [nearby, setNearby] = useState<NearbyVendor[]>([]);
  const [reviewMap, setReviewMap] = useState<Record<string, { averageRating: number; totalReviews: number }>>({});

  const [activeRequestId, setActiveRequestId] = useState<string>("");

  const [bookingKind, setBookingKind] = useState<"HOTEL" | "CAR" | "HALL" | "FLIGHT">("HOTEL");
  const [bookingCity, setBookingCity] = useState("Lagos");
  const [startAt, setStartAt] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [endAt, setEndAt] = useState(() => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [bookingResults, setBookingResults] = useState<BookingSearchListing[]>([]);
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);

  const physicalCategories = useMemo(
    () => categories.filter((c) => c.kind === "PHYSICAL"),
    [categories],
  );
  const featuredCategories = useMemo(() => physicalCategories.slice(0, 8), [physicalCategories]);
  const locationReady = lat != null && lng != null;

  async function bootstrap() {
    setTone("info");
    setStatus("Loading categories...");
    const res = await apiGet<CategoriesResponse>("/categories");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setCategories(res.data.categories);
    const first = res.data.categories.find((c) => c.kind === "PHYSICAL");
    if (first) setSelectedCategoryId(first.id);
    setTone("success");
    setStatus("Dashboard ready.");
  }

  useEffect(() => {
    const session = requireRole(router, "CONSUMER");
    if (!session) return;
    const timer = window.setTimeout(() => {
      void bootstrap();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  function detectMyLocation() {
    if (!navigator.geolocation) {
      setTone("error");
      setStatus("Geolocation is not supported in this browser.");
      return;
    }

    setTone("info");
    setStatus("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setTone("success");
        setStatus("Location detected.");
      },
      () => {
        setTone("error");
        setStatus("Could not detect location. Enable location access and retry.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function searchNearby() {
    if (lat == null || lng == null) {
      setTone("error");
      setStatus("Set your location first.");
      return;
    }
    if (!selectedCategoryId) {
      setTone("error");
      setStatus("Choose a category first.");
      return;
    }

    setTone("info");
    setStatus("Searching nearby verified vendors...");
    const res = await apiGet<NearbyResponse>(`/vendor/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&categoryId=${selectedCategoryId}&limit=20`);
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setNearby(res.data.vendors);
    void loadReviewSummaries(res.data.vendors);
    setTone("success");
    setStatus(`Found ${res.data.vendors.length} nearby vendor(s).`);
  }

  async function loadReviewSummaries(vendors: NearbyVendor[]) {
    if (!vendors.length) {
      setReviewMap({});
      return;
    }

    const entries = await Promise.all(
      vendors.map(async (v) => {
        const res = await apiGet<VendorReviewsResponse>(`/reviews/vendor/${v.id}?limit=5`);
        if (!res.ok || !res.data) {
          return [v.id, { averageRating: 0, totalReviews: 0 }] as const;
        }
        return [v.id, res.data.summary] as const;
      }),
    );

    setReviewMap(Object.fromEntries(entries));
  }

  async function requestMatch(vendorId?: string) {
    if (lat == null || lng == null) {
      setTone("error");
      setStatus("Set your location first.");
      return;
    }

    const category = categories.find((c) => c.id === selectedCategoryId);
    if (!category) {
      setTone("error");
      setStatus("Choose a valid category first.");
      return;
    }

    setTone("info");
    setStatus(vendorId ? "Sending request to selected vendor..." : "Dispatching request to nearest available vendors...");

    const payload = {
      mode: vendorId ? "CHOOSE" : "MATCHED",
      vendorId,
      city,
      category: category.name,
      description: issue,
      urgency,
      lat,
      lng,
    };

    const res = await apiPost<RequestCreateResponse>("/requests", payload);
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }

    setActiveRequestId(res.data.id);
    setTone("success");
    setStatus(`Request created successfully (${res.data.id}).`);
  }

  async function searchBookings() {
    setTone("info");
    setStatus("Searching booking inventory...");
    const res = await apiPost<BookingSearchResponse>("/booking/search", {
      kind: bookingKind,
      city: bookingCity,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      limit: 20,
    });

    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }

    setBookingResults(res.data.listings);
    setTone("success");
    setStatus(`Found ${res.data.listings.length} ${bookingKind.toLowerCase()} listing(s).`);
  }

  async function reserveBooking(listingId: string, paymentMethod: "WALLET" | "CARD") {
    setBookingBusyId(`${listingId}:${paymentMethod}`);
    setTone("info");
    setStatus("Creating quote...");
    const quoteRes = await apiPost<BookingQuoteResponse>("/booking/quote", {
      kind: bookingKind,
      provider: "LOCAL",
      listingId,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      quantity: 1,
    });

    if (!quoteRes.ok || !quoteRes.data) {
      setBookingBusyId(null);
      setTone("error");
      return setStatus(`Failed: ${quoteRes.error}`);
    }

    setStatus(paymentMethod === "CARD" ? "Initializing card checkout..." : "Confirming wallet payment...");
    const checkoutRes = await apiPost<BookingCheckoutResponse>("/booking/order/confirm", {
      quoteId: quoteRes.data.quote.id,
      paymentMethod,
      callbackUrl: paymentMethod === "CARD" && typeof window !== "undefined" ? `${window.location.origin}/bookings` : undefined,
    });
    setBookingBusyId(null);

    if (!checkoutRes.ok || !checkoutRes.data) {
      setTone("error");
      return setStatus(`Failed: ${checkoutRes.error}`);
    }

    if (paymentMethod === "CARD" && checkoutRes.data.payment?.authorization_url) {
      setTone("success");
      setStatus("Redirecting to card checkout...");
      window.location.assign(checkoutRes.data.payment.authorization_url);
      return;
    }

    setTone("success");
    setStatus("Booking confirmed with wallet.");
    router.push("/bookings");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.22),_transparent_38%),linear-gradient(145deg,#0f172a_0%,#172554_48%,#1e1b4b_100%)] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-100">Zota Concierge</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">
            Ask for exactly what you need. Zota routes services, bookings, and chats from one search flow.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
            Signed in as {user?.email ?? user?.phone}. Start with a clear request, pick a category only when you need to narrow it, and keep the rest of the screen focused.
          </p>

          <div className="mt-5 rounded-[26px] border border-white/10 bg-white/8 p-3 backdrop-blur">
            <div className="rounded-[22px] border border-white/10 bg-white px-4 py-4 text-slate-900 shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                Ask Zota
              </div>
              <textarea
                className="mt-3 min-h-[96px] w-full resize-none border-0 bg-transparent p-0 text-base leading-7 text-slate-900 outline-none placeholder:text-slate-400"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Describe what you need in plain language. Example: I need a trusted electrician in Lekki this evening, or find me a calm business hotel in Abuja for Friday."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_140px]">
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <option value="">Any category</option>
                  {physicalCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as "normal" | "urgent")}
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {featuredCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selectedCategoryId === c.id
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={searchNearby}
                >
                  Find verified pros
                </button>
                <button
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  onClick={() => requestMatch()}
                >
                  Auto-match now
                </button>
                <button
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={detectMyLocation}
                >
                  {locationReady ? "Refresh my location" : "Use my location"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className={`rounded-full border px-3 py-1.5 font-medium ${locationReady ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100" : "border-white/15 bg-white/10 text-slate-200"}`}>
              {locationReady ? "Location ready for nearby dispatch" : "Location not yet set"}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-slate-200">
              Radius {radiusKm}km
            </span>
            {activeRequestId && (
              <span className="rounded-full border border-indigo-300/30 bg-indigo-300/15 px-3 py-1.5 font-medium text-indigo-100">
                Live request {activeRequestId.slice(0, 8)}
              </span>
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Service dispatch</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-900">Nearby help, minus the noise.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ask in plain language, shortlist verified vendors, and turn the best match into a live request.
            </p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Booking engine</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-900">Hotels, halls, cars, flights.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep structured booking search available, but cleaner and secondary to the main concierge input.
            </p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Realtime support</p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-900">Messages and calls stay one tap away.</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/messages" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                Open inbox
              </Link>
              <Link href="/requests" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                Track requests
              </Link>
            </div>
          </article>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Verified vendors nearby</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">Clean shortlist, not clutter.</h2>
              </div>
              <div className="flex gap-2">
                <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={detectMyLocation}>
                  {locationReady ? "Refresh location" : "Set location"}
                </button>
                <button className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={searchNearby}>
                  Search
                </button>
              </div>
            </div>

            {nearby.length === 0 ? (
              <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                Once you search, verified vendors will appear here with distance, rating, and a direct path to request or message them.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {nearby.map((v) => (
                  <article key={v.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{v.businessName ?? "Unnamed Vendor"}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${v.isOnline ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {v.isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {v.city ?? city} · {v.distanceKm}km away · covers {v.coverageKm}km
                        </p>
                        <p className="mt-1 text-sm text-indigo-700">
                          {reviewMap[v.id] ? reviewMap[v.id].averageRating.toFixed(1) : "0.0"} rating · {reviewMap[v.id]?.totalReviews ?? 0} review(s)
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => requestMatch(v.id)}>
                          Request vendor
                        </button>
                        <Link className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" href={`/messages?vendorId=${encodeURIComponent(v.id)}`}>
                          Message
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Booking search</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">Structured booking, cleaner surface.</h2>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none" value={bookingKind} onChange={(e) => setBookingKind(e.target.value as "HOTEL" | "CAR" | "HALL" | "FLIGHT")}>
                  <option value="HOTEL">Hotels</option>
                  <option value="CAR">Car Rentals</option>
                  <option value="HALL">Event Halls</option>
                  <option value="FLIGHT">Flights</option>
                </select>
                <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none" value={bookingCity} onChange={(e) => setBookingCity(e.target.value)} placeholder="City" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
              <button className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700" onClick={searchBookings}>
                Search {bookingKind.toLowerCase()} availability
              </button>
            </div>

            {bookingResults.length === 0 ? (
              <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                Booking results stay tucked away until you ask for them. This keeps the dashboard focused on the main search action.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {bookingResults.map((b) => (
                  <article key={b.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{b.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">{b.kind} · {b.city ?? "-"} · {b.currency} {b.pricePerDay}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                          disabled={bookingBusyId === `${b.id}:CARD`}
                          onClick={() => reserveBooking(b.id, "CARD")}
                        >
                          {bookingBusyId === `${b.id}:CARD` ? "Processing..." : "Pay with card"}
                        </button>
                        <button
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                          disabled={bookingBusyId === `${b.id}:WALLET`}
                          onClick={() => reserveBooking(b.id, "WALLET")}
                        >
                          {bookingBusyId === `${b.id}:WALLET` ? "Processing..." : "Use wallet"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
