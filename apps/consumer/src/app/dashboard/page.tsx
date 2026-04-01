"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { readSession, type SessionUser } from "@/lib/session";
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
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [status, setStatus] = useState("Loading dashboard...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [city, setCity] = useState("Lagos");
  const [issue, setIssue] = useState("Find me a trusted mechanic near Paradise 2 Extension today.");
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
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const locationReady = lat != null && lng != null;
  const promptIdeas = useMemo(
    () => [
      "Find me a verified plumber near me",
      "Book a quiet hotel in Lagos for tomorrow",
      "I need a hall for 200 guests this weekend",
      "Get a mechanic to Paradise 2 Extension urgently",
    ],
    [],
  );
  const recommendationCards = useMemo(
    () =>
      (nearby.length
        ? nearby.slice(0, 6).map((vendor) => ({
            id: vendor.id,
            title: vendor.businessName ?? "Verified provider",
            subtitle: vendor.city ?? city,
            meta: `${vendor.distanceKm}km away`,
            badge: vendor.isOnline ? "Verified now" : "Verified",
            accent: "from-emerald-500/85 via-emerald-400/70 to-sky-400/75",
            rating: reviewMap[vendor.id]?.averageRating.toFixed(1) ?? "4.8",
          }))
        : [
            { id: "lagos", title: "Premium hotel stays", subtitle: city, meta: "Booked by verified hosts", badge: "Top rated", accent: "from-indigo-600/85 via-sky-500/75 to-cyan-400/80", rating: "4.9" },
            { id: "dispatch", title: "Trusted home services", subtitle: "Mechanics, cleaning, electrical", meta: "Fast local response", badge: "Verified", accent: "from-emerald-600/85 via-teal-500/70 to-lime-400/80", rating: "4.8" },
            { id: "events", title: "Business event halls", subtitle: "Meetings, launches, conferences", meta: "Flexible booking", badge: "Curated", accent: "from-amber-500/85 via-orange-500/70 to-rose-400/70", rating: "4.7" },
          ]),
    [city, nearby, reviewMap],
  );
  const experienceCards = useMemo(
    () =>
      (bookingResults.length
        ? bookingResults.slice(0, 6).map((listing) => ({
            id: listing.id,
            title: listing.title,
            subtitle: listing.city ?? city,
            price: `${listing.currency} ${listing.pricePerDay.toLocaleString()}`,
            type: listing.kind,
          }))
        : [
            { id: "stay", title: "Quiet business hotels", subtitle: city, price: "From NGN 75,000", type: "HOTEL" },
            { id: "ride", title: "Reliable airport transfers", subtitle: city, price: "From NGN 25,000", type: "CAR" },
            { id: "hall", title: "Event-ready spaces", subtitle: city, price: "From NGN 180,000", type: "HALL" },
          ]),
    [bookingResults, city],
  );

  async function smartSearch() {
    const query = issue.toLowerCase();
    const bookingIntent = ["hotel", "stay", "flight", "car rental", "rent a car", "hall", "event", "booking"].some((term) =>
      query.includes(term),
    );

    if (bookingIntent) {
      await searchBookings();
      return;
    }

    if (!selectedCategoryId && physicalCategories[0]) {
      setSelectedCategoryId(physicalCategories[0].id);
    }

    if (!locationReady) {
      setTone("info");
      setStatus("Allow location or use the nearby card so Zota can find the right provider.");
      return;
    }

    await searchNearby();
  }

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
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "CONSUMER");
        if (!session || cancelled) return;
        setUser(session.user);
        await bootstrap();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6">
        <section className="rounded-[34px] bg-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Zota Explore</p>
              <h1 className="mt-3 text-5xl font-black leading-none tracking-[-0.06em] text-emerald-950">
                Where to?
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
                One intelligent search for verified services, bookings, local dispatch, realtime support, and wallet-ready checkout.
              </p>
            </div>
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="mt-2 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-950"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M10 17a2 2 0 0 0 4 0" />
              </svg>
            </Link>
          </div>

          <div className="mt-8 rounded-[34px] border-2 border-emerald-200 bg-white px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4">
              <div className="mt-1 text-emerald-950">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16 21 21" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <textarea
                  className="min-h-[54px] w-full resize-none border-0 bg-transparent p-0 text-[1.05rem] leading-7 text-slate-800 outline-none placeholder:text-slate-400"
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Ask for hotels, dispatch, business services, products, halls, or live support..."
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 outline-none"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setBookingCity(e.target.value);
                    }}
                    placeholder="City"
                  />
                  <select
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 outline-none"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as "normal" | "urgent")}
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <button
                    className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white"
                    onClick={smartSearch}
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {promptIdeas.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setIssue(prompt)}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-7 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f5fbf8_0%,#eefaf7_100%)] p-4">
            <button
              className="flex w-full items-center justify-between gap-4 rounded-[24px] bg-white px-4 py-4 text-left shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
              onClick={detectMyLocation}
            >
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[radial-gradient(circle_at_center,_#3b82f6_0,_#93c5fd_20%,_#dbeafe_20%,_#dbeafe_37%,_#eff6ff_37%,_#eff6ff_100%)]">
                  <div className="h-5 w-5 rounded-full bg-blue-600 ring-8 ring-blue-200/70" />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-[-0.03em] text-emerald-950">Explore nearby</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {locationReady ? "Location connected for smart local matching" : "Allow location access"}
                  </p>
                </div>
              </div>
              <span className="text-4xl leading-none text-emerald-950">›</span>
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Search context</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">One search, every engine</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
                  {selectedCategory?.name ?? "Discovery"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {featuredCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      selectedCategoryId === c.id
                        ? "bg-emerald-950 text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:text-emerald-900"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-[22px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">How Zota will interpret your prompt</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Write naturally. Zota routes intent into booking, dispatch, nearby discovery, messages, calls, or checkout without forcing you through separate forms.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Quick actions</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Move faster</h2>
              <div className="mt-4 space-y-3">
                <button className="flex w-full items-center justify-between rounded-[22px] border border-slate-200 px-4 py-4 text-left" onClick={() => requestMatch()}>
                  <div>
                    <p className="font-bold text-slate-900">Auto-match request</p>
                    <p className="mt-1 text-sm text-slate-500">Dispatch this request to the best verified provider nearby.</p>
                  </div>
                  <span className="text-2xl text-emerald-950">→</span>
                </button>
                <button className="flex w-full items-center justify-between rounded-[22px] border border-slate-200 px-4 py-4 text-left" onClick={searchBookings}>
                  <div>
                    <p className="font-bold text-slate-900">Search bookings</p>
                    <p className="mt-1 text-sm text-slate-500">Hotels, halls, transport, and other reserve-now inventory.</p>
                  </div>
                  <span className="text-2xl text-emerald-950">→</span>
                </button>
                <Link href="/messages" className="flex items-center justify-between rounded-[22px] border border-slate-200 px-4 py-4">
                  <div>
                    <p className="font-bold text-slate-900">Open messages and calls</p>
                    <p className="mt-1 text-sm text-slate-500">Continue conversations, negotiate, and place calls in-app.</p>
                  </div>
                  <span className="text-2xl text-emerald-950">→</span>
                </Link>
                {activeRequestId && (
                  <Link href="/requests" className="flex items-center justify-between rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div>
                      <p className="font-bold text-emerald-950">Track active request</p>
                      <p className="mt-1 text-sm text-emerald-700">Request {activeRequestId.slice(0, 8)} is currently live.</p>
                    </div>
                    <span className="text-2xl text-emerald-950">→</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-3xl font-black tracking-[-0.05em] text-slate-950">You might like</h2>
            <Link href="/bookings" className="text-base font-semibold text-emerald-900 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {recommendationCards.map((card) => (
              <article
                key={card.id}
                className={`relative min-h-[320px] min-w-[300px] overflow-hidden rounded-[28px] bg-gradient-to-br ${card.accent} p-5 text-white shadow-[0_24px_45px_rgba(15,23,42,0.18)]`}
              >
                <div className="absolute left-5 top-5 rounded-2xl bg-[#f9f34c] px-3 py-2 text-sm font-black text-emerald-950 shadow">
                  ★ {card.rating}
                </div>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.2)_36%,rgba(15,23,42,0.8)_100%)]" />
                <div className="relative flex h-full flex-col justify-end">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/80">{card.badge}</p>
                  <h3 className="mt-3 text-4xl font-black tracking-[-0.05em]">{card.title}</h3>
                  <p className="mt-2 text-2xl font-semibold">{card.subtitle}</p>
                  <p className="mt-1 text-sm text-white/80">{card.meta}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl font-black tracking-[-0.05em] text-emerald-950">Must-do picks in {city}</h2>
              <p className="mt-1 text-sm text-slate-500">Services, stays, and fast booking paths from one feed.</p>
            </div>
            <Link href="/requests" className="text-base font-semibold text-emerald-900 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {experienceCards.map((item) => (
              <article key={item.id} className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
                <div className="h-40 rounded-[22px] bg-[linear-gradient(135deg,#dbeafe_0%,#ecfeff_45%,#dcfce7_100%)]" />
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
                    {item.type}
                  </span>
                  <span className="rounded-full border border-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                    Verified
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-slate-950">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Starting from</p>
                    <p className="text-lg font-bold text-slate-900">{item.price}</p>
                  </div>
                  <button
                    className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white"
                    onClick={item.type === "HOTEL" || item.type === "CAR" || item.type === "HALL" || item.type === "FLIGHT" ? searchBookings : smartSearch}
                  >
                    Explore
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Best nearby</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Verified local matches</h2>
              </div>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={searchNearby}
              >
                Refresh
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {nearby.length === 0 ? (
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">No nearby providers loaded yet</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Turn on location and search from the main bar. Zota will find verified providers near your current area.
                  </p>
                </div>
              ) : (
                nearby.slice(0, 4).map((vendor) => {
                  const review = reviewMap[vendor.id];
                  return (
                    <article key={vendor.id} className="rounded-[24px] border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">
                              {vendor.businessName ?? "Verified provider"}
                            </h3>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
                              {vendor.isOnline ? "Online" : "Verified"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {vendor.city ?? city} · {vendor.distanceKm}km away · coverage {vendor.coverageKm}km
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Rating</p>
                          <p className="text-sm font-black text-slate-950">
                            {review?.averageRating.toFixed(1) ?? "4.8"} · {review?.totalReviews ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/messages?vendorId=${vendor.id}&message=${encodeURIComponent(issue)}`}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Message
                        </Link>
                        <button
                          className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white"
                          onClick={() => requestMatch(vendor.id)}
                        >
                          Request this vendor
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Book and reserve</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Booking snapshot</h2>
              </div>
              <select
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 outline-none"
                value={bookingKind}
                onChange={(e) => setBookingKind(e.target.value as "HOTEL" | "CAR" | "HALL" | "FLIGHT")}
              >
                <option value="HOTEL">Hotels</option>
                <option value="CAR">Cars</option>
                <option value="HALL">Halls</option>
                <option value="FLIGHT">Flights</option>
              </select>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                value={bookingCity}
                onChange={(e) => setBookingCity(e.target.value)}
                placeholder="Booking city"
              />
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                placeholder="Nearby radius"
              />
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <button className="mt-4 rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white" onClick={searchBookings}>
              Refresh inventory
            </button>
            <div className="mt-4 space-y-3">
              {(bookingResults.length ? bookingResults.slice(0, 3) : []).map((listing) => (
                <article key={listing.id} className="rounded-[24px] border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">{listing.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{listing.city ?? city} · {listing.kind}</p>
                    </div>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                      {listing.currency} {listing.pricePerDay.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                      disabled={bookingBusyId === `${listing.id}:CARD`}
                      onClick={() => reserveBooking(listing.id, "CARD")}
                    >
                      Pay with card
                    </button>
                    <button
                      className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={bookingBusyId === `${listing.id}:WALLET`}
                      onClick={() => reserveBooking(listing.id, "WALLET")}
                    >
                      Use wallet
                    </button>
                  </div>
                </article>
              ))}
              {bookingResults.length === 0 && (
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">No booking results yet</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Ask for hotels, flights, halls, or rentals in the search bar and Zota will route to booking inventory automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
