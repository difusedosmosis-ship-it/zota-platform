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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Customer Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome {user?.email ?? user?.phone}. Find nearby verified providers and booking services in one place.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900">Physical Service Request (Geo Dispatch)</h2>
            <p className="text-gray-600 mt-1">Example flow: car breakdown to nearest approved mechanic to instant request.</p>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {physicalCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input className="w-full px-4 py-3 border border-gray-300 rounded-lg sm:col-span-2" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Describe issue" />
              <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" value={urgency} onChange={(e) => setUrgency(e.target.value as "normal" | "urgent")}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
              <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" type="number" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} placeholder="Radius (km)" />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button className="px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50" onClick={detectMyLocation}>Use My Location</button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50" onClick={searchNearby}>Search Nearby</button>
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={() => requestMatch()}>Auto-Match Request</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {physicalCategories.slice(0, 12).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium ${
                    selectedCategoryId === c.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <p className="text-sm text-gray-500 mt-3">Geo: {lat ?? "-"}, {lng ?? "-"}</p>
            {activeRequestId && <p className="text-sm text-indigo-700 mt-1">Active request ID: {activeRequestId}</p>}

            <div className="mt-4 space-y-2">
              {nearby.map((v) => (
                <div key={v.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{v.businessName ?? "Unnamed Vendor"}</p>
                    <p className="text-sm text-gray-600">{v.city ?? "-"} · {v.distanceKm}km away · coverage {v.coverageKm}km</p>
                    <p className="text-xs text-indigo-700 mt-1">
                      Rating: {reviewMap[v.id] ? reviewMap[v.id].averageRating.toFixed(1) : "0.0"} ({reviewMap[v.id]?.totalReviews ?? 0} review(s))
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-semibold" onClick={() => requestMatch(v.id)}>
                      Request This Vendor
                    </button>
                    <Link className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-center rounded-lg font-semibold text-gray-700" href={`/messages?vendorId=${encodeURIComponent(v.id)}`}>
                      Message
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900">Booking Engine</h2>
            <p className="text-gray-600 mt-1">Hotels, car rentals, flights, and event halls from one booking flow.</p>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" value={bookingKind} onChange={(e) => setBookingKind(e.target.value as "HOTEL" | "CAR" | "HALL" | "FLIGHT")}>
                <option value="HOTEL">Hotels</option>
                <option value="CAR">Car Rentals</option>
                <option value="HALL">Event Halls</option>
                <option value="FLIGHT">Flights</option>
              </select>
              <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" value={bookingCity} onChange={(e) => setBookingCity(e.target.value)} placeholder="City" />
              <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>

            <div className="mt-4 flex gap-3">
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={searchBookings}>Search Booking Services</button>
            </div>

            <div className="mt-4 space-y-2">
              {bookingResults.map((b) => (
                <div key={b.id} className="border border-gray-200 rounded-lg p-3">
                  <p className="font-semibold text-gray-900">{b.title}</p>
                  <p className="text-sm text-gray-600">{b.kind} · {b.city ?? "-"} · {b.currency} {b.pricePerDay}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
                      disabled={bookingBusyId === `${b.id}:CARD`}
                      onClick={() => reserveBooking(b.id, "CARD")}
                    >
                      {bookingBusyId === `${b.id}:CARD` ? "Processing..." : "Reserve With Card"}
                    </button>
                    <button
                      className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60"
                      disabled={bookingBusyId === `${b.id}:WALLET`}
                      onClick={() => reserveBooking(b.id, "WALLET")}
                    >
                      {bookingBusyId === `${b.id}:WALLET` ? "Processing..." : "Pay With Wallet"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
