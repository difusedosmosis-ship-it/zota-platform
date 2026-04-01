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

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

const visualCards = [
  {
    id: "hotels",
    title: "Top-rated premium hotels",
    subtitle: "Best reviewed stays around your city",
    badge: "Verified hosts",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "services",
    title: "Trusted home services",
    subtitle: "Mechanics, cleaning, electrical, repairs",
    badge: "Trusted teams",
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "events",
    title: "Business event halls",
    subtitle: "Clean spaces for launches, meetings, and events",
    badge: "Ready to book",
    rating: "4.7",
    image:
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80",
  },
] as const;

export default function ConsumerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [status, setStatus] = useState("Loading explore...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [city, setCity] = useState("Lagos");
  const [issue, setIssue] = useState("Find me a trusted mechanic near Paradise 2 Extension today.");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("urgent");
  const [isListening, setIsListening] = useState(false);

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

  const physicalCategories = useMemo(() => categories.filter((c) => c.kind === "PHYSICAL"), [categories]);
  const featuredCategories = useMemo(() => physicalCategories.slice(0, 6), [physicalCategories]);
  const locationReady = lat != null && lng != null;
  const promptIdeas = useMemo(
    () => [
      "Need a plumber near me now",
      "Book a premium hotel in Lagos for tomorrow",
      "Find an event hall for 200 guests",
      "Show me trusted electricians around me",
    ],
    [],
  );

  const recommendationCards = useMemo(() => {
    if (!nearby.length) return visualCards;
    return nearby.slice(0, 3).map((vendor, index) => ({
      id: vendor.id,
      title: vendor.businessName ?? "Verified provider",
      subtitle: `${vendor.city ?? city} · ${vendor.distanceKm}km away`,
      badge: vendor.isOnline ? "Available now" : "Verified",
      rating: reviewMap[vendor.id]?.averageRating.toFixed(1) ?? "4.8",
      image: visualCards[index % visualCards.length].image,
    }));
  }, [city, nearby, reviewMap]);

  const experienceCards = useMemo(
    () =>
      bookingResults.length
        ? bookingResults.slice(0, 3).map((listing, index) => ({
            id: listing.id,
            title: listing.title,
            subtitle: listing.city ?? city,
            price: `${listing.currency} ${listing.pricePerDay.toLocaleString()}`,
            type: listing.kind,
            image: visualCards[index % visualCards.length].image,
          }))
        : [
            {
              id: "stay",
              title: "Premium hotel stays",
              subtitle: city,
              price: "From NGN 75,000",
              type: "HOTEL",
              image: visualCards[0].image,
            },
            {
              id: "ride",
              title: "Reliable car rentals",
              subtitle: city,
              price: "From NGN 25,000",
              type: "CAR",
              image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
            },
            {
              id: "hall",
              title: "Event-ready halls",
              subtitle: city,
              price: "From NGN 180,000",
              type: "HALL",
              image: visualCards[2].image,
            },
          ],
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
      setStatus("Allow location so Zota can find the right provider around you.");
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
    setStatus("Explore ready.");
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
        setStatus("Location connected.");
      },
      () => {
        setTone("error");
        setStatus("Could not detect location. Enable location access and retry.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function startVoiceInput() {
    const browserWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setTone("error");
      setStatus("Voice input is not supported on this device.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setIssue(transcript);
    };
    recognition.onerror = () => {
      setTone("error");
      setStatus("Could not capture voice input.");
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.start();
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
        <section className="rounded-[28px] bg-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Explore</p>
            <h1 className="mt-2 text-[2rem] font-bold tracking-[-0.04em] text-slate-950">Find what you need</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Search services, bookings, and trusted vendors in one place.
            </p>
          </div>

          <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-3 rounded-[22px] bg-slate-50 px-4 py-3">
              <div className="pt-1 text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16 21 21" />
                </svg>
              </div>
              <textarea
                className="min-h-[60px] flex-1 resize-none border-0 bg-transparent p-0 text-[0.98rem] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Ask for a hotel, a mechanic, an event hall, a booking, or any verified service..."
              />
              <div className="flex items-center gap-2 self-end pb-1">
                <button
                  aria-label="Voice input"
                  onClick={startVoiceInput}
                  className={`grid h-10 w-10 place-items-center rounded-full border ${isListening ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
                    <path d="M19 11a7 7 0 0 1-14 0" />
                    <path d="M12 18v3" />
                  </svg>
                </button>
                <button
                  aria-label="Send search"
                  onClick={smartSearch}
                  className="grid h-10 w-10 place-items-center rounded-full bg-emerald-950 text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 12h13" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
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

          <div className="mt-5 flex flex-wrap gap-2">
            {featuredCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryId(c.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${selectedCategoryId === c.id ? "bg-emerald-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <button
            className="mt-5 flex w-full items-center justify-between rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f5fbf8_0%,#ffffff_100%)] px-4 py-4 text-left"
            onClick={detectMyLocation}
          >
            <div>
              <p className="text-base font-semibold text-slate-950">Nearby services</p>
              <p className="mt-1 text-sm text-slate-500">
                {locationReady ? "Location connected for smarter local results" : "Turn on location for nearby matches"}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              {locationReady ? "Connected" : "Enable"}
            </span>
          </button>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-950">You might like</h2>
            <Link href="/bookings" className="text-sm font-medium text-emerald-900 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {recommendationCards.map((card) => (
              <article key={card.id} className="relative min-h-[280px] min-w-[280px] overflow-hidden rounded-[28px] shadow-[0_24px_45px_rgba(15,23,42,0.18)]">
                <img src={card.image} alt={card.title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.22)_36%,rgba(15,23,42,0.82)_100%)]" />
                <div className="absolute left-4 top-4 rounded-2xl bg-[#f9f34c] px-3 py-2 text-sm font-black text-slate-950 shadow">★ {card.rating}</div>
                <div className="relative flex h-full flex-col justify-end p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{card.badge}</p>
                  <h3 className="mt-3 text-3xl font-bold tracking-[-0.04em]">{card.title}</h3>
                  <p className="mt-2 text-sm text-white/80">{card.subtitle}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Must-do picks in {city}</h2>
              <p className="mt-1 text-sm text-slate-500">Services and spaces people are booking most.</p>
            </div>
            <Link href="/requests" className="text-sm font-medium text-emerald-900 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {experienceCards.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
                <img src={item.image} alt={item.title} className="h-44 w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      {item.type}
                    </span>
                    <span className="rounded-full border border-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
                      Verified
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Starting from</p>
                      <p className="text-base font-semibold text-slate-900">{item.price}</p>
                    </div>
                    <button
                      className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white"
                      onClick={item.type === "HOTEL" || item.type === "CAR" || item.type === "HALL" || item.type === "FLIGHT" ? searchBookings : smartSearch}
                    >
                      Explore
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Nearby matches</h2>
                <p className="mt-1 text-sm text-slate-500">Trusted providers around your current area.</p>
              </div>
              <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={searchNearby}>
                Refresh
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {nearby.length === 0 ? (
                <div className="rounded-[22px] bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  Turn on location and run a search. Zota will automatically match the best nearby providers without exposing extra steps.
                </div>
              ) : (
                nearby.slice(0, 4).map((vendor) => {
                  const review = reviewMap[vendor.id];
                  return (
                    <article key={vendor.id} className="rounded-[22px] border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-950">{vendor.businessName ?? "Verified provider"}</h3>
                          <p className="mt-1 text-sm text-slate-500">{vendor.city ?? city} · {vendor.distanceKm}km away</p>
                        </div>
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                          {review?.averageRating.toFixed(1) ?? "4.8"} · {review?.totalReviews ?? 0}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/messages?vendorId=${vendor.id}&message=${encodeURIComponent(issue)}`}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Message
                        </Link>
                        <button className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white" onClick={() => requestMatch(vendor.id)}>
                          Request
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
                <h2 className="text-xl font-semibold text-slate-950">Booking options</h2>
                <p className="mt-1 text-sm text-slate-500">Reserve stays, halls, cars, and more.</p>
              </div>
              <select
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 outline-none"
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
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                value={bookingCity}
                onChange={(e) => setBookingCity(e.target.value)}
                placeholder="Booking city"
              />
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                placeholder="Nearby radius"
              />
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <button className="mt-4 rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white" onClick={searchBookings}>
              Search bookings
            </button>
            <div className="mt-4 space-y-3">
              {bookingResults.length === 0 ? (
                <div className="rounded-[22px] bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  Search for a hotel, hall, flight, or car and Zota will show the closest matching inventory.
                </div>
              ) : (
                bookingResults.slice(0, 3).map((listing) => (
                  <article key={listing.id} className="rounded-[22px] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">{listing.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">{listing.city ?? city} · {listing.kind}</p>
                      </div>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {listing.currency} {listing.pricePerDay.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                        disabled={bookingBusyId === `${listing.id}:CARD`}
                        onClick={() => reserveBooking(listing.id, "CARD")}
                      >
                        Pay with card
                      </button>
                      <button
                        className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        disabled={bookingBusyId === `${listing.id}:WALLET`}
                        onClick={() => reserveBooking(listing.id, "WALLET")}
                      >
                        Wallet
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
