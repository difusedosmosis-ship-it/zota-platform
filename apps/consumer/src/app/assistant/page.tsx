"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { pushNotification } from "@/lib/notifications";
import { readSession, type SessionUser } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

type Category = { id: string; name: string; kind: string };
type CategoriesResponse = { ok: boolean; categories: Category[] };

type NearbyVendor = {
  id: string;
  businessName: string | null;
  city: string | null;
  coverageKm: number;
  isOnline: boolean;
  distanceKm: number;
};

type NearbyResponse = { ok: boolean; vendors: NearbyVendor[] };

type VendorReviewsResponse = {
  ok: boolean;
  summary: { averageRating: number; totalReviews: number };
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

type BookingSearchResponse = { ok: boolean; provider: string; listings: BookingSearchListing[] };

type RequestCreateResponse = { ok: boolean; id: string };

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export default function ConsumerAssistantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(() => readSession()?.user ?? null);
  const [status, setStatus] = useState("Opening assistant...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [canUseVoiceInput, setCanUseVoiceInput] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nearby, setNearby] = useState<NearbyVendor[]>([]);
  const [reviewMap, setReviewMap] = useState<Record<string, { averageRating: number; totalReviews: number }>>({});
  const [bookingResults, setBookingResults] = useState<BookingSearchListing[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [city, setCity] = useState("Lagos");

  const physicalCategories = useMemo(() => categories.filter((c) => c.kind === "PHYSICAL"), [categories]);
  const initialQuery = searchParams.get("q") ?? "";

  async function bootstrap() {
    const session = await requireRole(router, "CONSUMER");
    if (!session) return false;
    setUser(session.user);

    const categoryRes = await apiGet<CategoriesResponse>("/categories");
    if (categoryRes.ok && categoryRes.data) {
      setCategories(categoryRes.data.categories);
    }
    setTone("success");
    setStatus("Assistant ready.");
    return true;
  }

  function detectLocation(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  async function loadReviewSummaries(vendors: NearbyVendor[]) {
    if (!vendors.length) {
      setReviewMap({});
      return;
    }

    const entries = await Promise.all(
      vendors.map(async (vendor) => {
        const res = await apiGet<VendorReviewsResponse>(`/reviews/vendor/${vendor.id}?limit=5`);
        if (!res.ok || !res.data) {
          return [vendor.id, { averageRating: 0, totalReviews: 0 }] as const;
        }
        return [vendor.id, res.data.summary] as const;
      }),
    );

    setReviewMap(Object.fromEntries(entries));
  }

  function findBestCategoryId(query: string) {
    const lower = query.toLowerCase();
    const exact = physicalCategories.find((category) => lower.includes(category.name.toLowerCase()));
    return exact?.id ?? physicalCategories[0]?.id ?? "";
  }

  async function runAssistant(nextPrompt?: string) {
    const query = (nextPrompt ?? prompt).trim();
    if (!query) return;

    setIsRunning(true);
    setPrompt(query);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: query }]);
    setNearby([]);
    setBookingResults([]);

    const bookingIntent = ["hotel", "stay", "flight", "car rental", "rent a car", "hall", "event", "booking"].some((term) =>
      query.toLowerCase().includes(term),
    );

    try {
      if (bookingIntent) {
        setStatus("Searching booking inventory...");
        const bookingKind = query.toLowerCase().includes("flight")
          ? "FLIGHT"
          : query.toLowerCase().includes("hall") || query.toLowerCase().includes("event")
            ? "HALL"
            : query.toLowerCase().includes("car")
              ? "CAR"
              : "HOTEL";
        const res = await apiPost<BookingSearchResponse>("/booking/search", {
          kind: bookingKind,
          city,
          startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 12,
        });
        if (!res.ok || !res.data) {
          throw new Error(res.error ?? "Could not load booking options.");
        }
        setBookingResults(res.data!.listings);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: res.data!.listings.length
              ? `I found ${res.data!.listings.length} booking options that match your request. Review the cards below and continue with the one that fits.`
              : "I could not find a direct booking match yet. Try a different city, date, or booking type.",
          },
        ]);
        setTone("success");
        setStatus("Booking results ready.");
        return;
      }

      setStatus("Searching trusted providers around you...");
      const position = lat != null && lng != null ? { lat, lng } : await detectLocation();
      if (!position) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Turn on location access so I can find the best nearby providers for this request.",
          },
        ]);
        setTone("error");
        setStatus("Location needed for nearby service search.");
        return;
      }

      const categoryId = findBestCategoryId(query);
      if (!categoryId) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "I could not map that request to a supported service category yet. Try naming the service more directly.",
          },
        ]);
        setTone("error");
        setStatus("Could not map the request to a category.");
        return;
      }

      const res = await apiGet<NearbyResponse>(`/vendor/nearby?lat=${position.lat}&lng=${position.lng}&radiusKm=10&categoryId=${categoryId}&limit=8`);
      if (!res.ok || !res.data) {
        throw new Error(res.error ?? "Could not load nearby providers.");
      }
      setNearby(res.data!.vendors);
      await loadReviewSummaries(res.data!.vendors);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: res.data!.vendors.length
            ? `I found ${res.data!.vendors.length} verified provider matches near you. Open a card below to message or request a vendor.`
            : "No nearby providers matched that request yet. Try a different phrase or service type.",
        },
      ]);
      setTone("success");
      setStatus("Nearby matches ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assistant request failed.";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: message }]);
      setTone("error");
      setStatus(message);
    } finally {
      setIsRunning(false);
    }
  }

  async function requestVendor(vendorId: string) {
    const position = lat != null && lng != null ? { lat, lng } : await detectLocation();
    if (!position) {
      setTone("error");
      setStatus("Location is required before sending a request.");
      return;
    }

    const categoryId = findBestCategoryId(prompt);
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      setTone("error");
      setStatus("Could not determine the request category.");
      return;
    }

    const res = await apiPost<RequestCreateResponse>("/requests", {
      mode: "CHOOSE",
      vendorId,
      city,
      category: category.name,
      description: prompt,
      urgency: "urgent",
      lat: position.lat,
      lng: position.lng,
    });

    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }

    setTone("success");
    setStatus(`Request ${res.data!.id.slice(0, 8)} created.`);
    pushNotification({
      title: "Request sent",
      body: `${prompt || category.name} request has been sent to the selected business.`,
      href: "/requests",
    });
  }

  function startVoiceInput() {
    const browserWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus("");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setPrompt(transcript);
    };
    recognition.onerror = () => {
      setTone("info");
      setStatus("Voice input is unavailable right now. Type your request instead.");
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  useEffect(() => {
    const browserWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    setCanUseVoiceInput(Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const ready = await bootstrap();
        if (!ready || cancelled) return;
        if (initialQuery) {
          setPrompt(initialQuery);
          await runAssistant(initialQuery);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className="bm-safe-page min-h-screen bg-white text-slate-950">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-3 sm:px-6">
        <header className="sticky top-0 z-40 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => router.back()}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700"
              aria-label="Minimize"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 18 9 12l6-6" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Zota AI</p>
              <h1 className="text-base font-semibold text-slate-950">Assistant</h1>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 6 18 18" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
          <div className="flex items-start gap-3 rounded-[22px] bg-slate-50 px-4 py-3">
            <div className="pt-1 text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16 21 21" />
              </svg>
            </div>
            <textarea
              className="min-h-[80px] flex-1 resize-none border-0 bg-transparent p-0 text-[1rem] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tell Zota what you need. Example: find a verified mechanic near me, book a premium hotel in Lagos, or show me event halls for 200 guests."
            />
            <div className="flex items-center gap-2 self-end pb-1">
              {canUseVoiceInput ? (
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
              ) : null}
              <button
                aria-label="Run assistant"
                onClick={() => void runAssistant()}
                disabled={isRunning || !prompt.trim()}
                className="grid h-10 w-10 place-items-center rounded-full bg-emerald-950 text-white disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 12h13" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[
            "Find a plumber near me now",
            "Book a hotel in Lagos tomorrow",
            "Show me event halls for 200 guests",
            "Find verified electricians around me",
          ].map((idea) => (
            <button
              key={idea}
              onClick={() => {
                setPrompt(idea);
                void runAssistant(idea);
              }}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {idea}
            </button>
          ))}
        </div>

        <section className="mt-6 space-y-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-[24px] px-4 py-3 ${message.role === "user" ? "bg-emerald-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-900"}`}>
                <p className="text-sm leading-6">{message.text}</p>
              </div>
            </div>
          ))}
        </section>

        {nearby.length > 0 && (
          <section className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Nearby matches</h2>
                <p className="mt-1 text-sm text-slate-500">Verified providers around your current location.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {nearby.map((vendor) => {
                const review = reviewMap[vendor.id];
                return (
                  <article key={vendor.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">{vendor.businessName ?? "Verified provider"}</h3>
                        <p className="mt-1 text-sm text-slate-500">{vendor.city ?? city} · {vendor.distanceKm}km away · coverage {vendor.coverageKm}km</p>
                      </div>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {review?.averageRating.toFixed(1) ?? "4.8"} · {review?.totalReviews ?? 0}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/messages?vendorId=${vendor.id}&message=${encodeURIComponent(prompt)}`}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        Message
                      </Link>
                      <button
                        className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white"
                        onClick={() => void requestVendor(vendor.id)}
                      >
                        Request
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {bookingResults.length > 0 && (
          <section className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Booking options</h2>
                <p className="mt-1 text-sm text-slate-500">Available options matching your request.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {bookingResults.map((listing) => (
                <article key={listing.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{listing.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{listing.city ?? city} · {listing.kind}</p>
                    </div>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {listing.currency} {listing.pricePerDay.toLocaleString()}
                    </span>
                  </div>
                  <Link href="/bookings" className="mt-4 inline-flex rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white">
                    Open bookings
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <StatusToast message={status} tone={tone} />
    </div>
  );
}
