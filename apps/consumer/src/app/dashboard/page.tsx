"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet } from "@/lib/api";
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

type NearbyResponse = {
  ok: boolean;
  vendors: NearbyVendor[];
};

type FeaturedVendor = {
  id: string;
  businessName: string | null;
  city: string | null;
  services: Array<{
    id: string;
    title: string;
    coverImageUrl?: string | null;
    category: { name: string };
  }>;
};

type FeaturedVendorResponse = {
  ok: boolean;
  vendors: FeaturedVendor[];
};

type PublicBookingListing = {
  id: string;
  kind: "HOTEL" | "CAR" | "HALL" | "FLIGHT";
  title: string;
  city: string | null;
  currency: string;
  pricePerDay: number;
};

type PublicBookingListingResponse = {
  ok: boolean;
  listings: PublicBookingListing[];
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
  const [featuredVendors, setFeaturedVendors] = useState<FeaturedVendor[]>([]);
  const [featuredBookings, setFeaturedBookings] = useState<PublicBookingListing[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [nearby, setNearby] = useState<NearbyVendor[]>([]);

  const promptIdeas = useMemo(
    () => [
      "Need a plumber near me now",
      "Book a premium hotel in Lagos for tomorrow",
      "Find an event hall for 200 guests",
      "Show me trusted electricians around me",
    ],
    [],
  );

  const featuredCategories = useMemo(
    () => categories.filter((c) => c.kind === "PHYSICAL").slice(0, 6),
    [categories],
  );

  const nearbyPreview = useMemo(() => nearby.slice(0, 2), [nearby]);
  const featuredVendorCards = useMemo(
    () =>
      featuredVendors.slice(0, 3).map((vendor, index) => ({
        id: vendor.id,
        vendorId: vendor.id,
        serviceId: vendor.services[0]?.id ?? "",
        title: vendor.businessName ?? "Verified business",
        subtitle: vendor.services[0]?.title ?? vendor.city ?? "Business profile",
        badge: vendor.services[0]?.category.name ?? "Business",
        city: vendor.city ?? "Nigeria",
        rating: ["4.9", "4.8", "4.7"][index % 3],
        image: vendor.services[0]?.coverImageUrl || visualCards[index % visualCards.length].image,
      })),
    [featuredVendors],
  );
  const featuredBookingCards = useMemo(
    () =>
      featuredBookings.slice(0, 3).map((listing, index) => ({
        id: listing.id,
        title: listing.title,
        subtitle: listing.city ?? "Nigeria",
        type: listing.kind,
        price: `${listing.currency} ${listing.pricePerDay.toLocaleString()}`,
        image: visualCards[index % visualCards.length].image,
      })),
    [featuredBookings],
  );

  async function bootstrap() {
    setTone("info");
    setStatus("Loading categories...");
    const [categoryRes, vendorRes, bookingRes] = await Promise.all([
      apiGet<CategoriesResponse>("/categories"),
      apiGet<FeaturedVendorResponse>("/vendor/featured?city=Lagos&limit=6"),
      apiGet<PublicBookingListingResponse>("/booking/public/listings?city=Lagos&limit=6"),
    ]);
    if (!categoryRes.ok || !categoryRes.data) {
      setTone("error");
      return setStatus(`Failed: ${categoryRes.error}`);
    }
    setCategories(categoryRes.data.categories);
    if (vendorRes.ok && vendorRes.data) setFeaturedVendors(vendorRes.data.vendors);
    if (bookingRes.ok && bookingRes.data) setFeaturedBookings(bookingRes.data.listings);
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

  function openAssistant(prompt?: string) {
    const params = new URLSearchParams();
    if (prompt) params.set("q", prompt);
    router.push(`/assistant${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function buildVendorHref(card: {
    vendorId: string;
    serviceId?: string;
    title: string;
    subtitle: string;
    badge: string;
    image: string;
    city?: string;
  }) {
    const params = new URLSearchParams({
      businessName: card.title,
      serviceTitle: card.subtitle,
      category: card.badge,
      image: card.image,
      city: card.city ?? "Nigeria",
    });
    if (card.serviceId) params.set("serviceId", card.serviceId);
    return `/vendors/${card.vendorId}?${params.toString()}`;
  }

  function detectMyLocation() {
    if (!navigator.geolocation) {
      setTone("error");
      setStatus("Geolocation is not supported in this browser.");
      return;
    }

    setTone("info");
    setStatus("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        const category = featuredCategories[0];
        if (!category) {
          setTone("success");
          setStatus("Location connected.");
          return;
        }
        const res = await apiGet<NearbyResponse>(`/vendor/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radiusKm=10&categoryId=${category.id}&limit=4`);
        if (res.ok && res.data) {
          setNearby(res.data.vendors);
          setTone("success");
          setStatus("Nearby services updated.");
          return;
        }
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

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6">
        <section className="rounded-[28px] bg-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Explore</p>
            <h1 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em] text-slate-950">Find what you need</h1>
          </div>

          <button
            onClick={() => openAssistant()}
            className="mt-5 flex w-full items-center gap-3 rounded-[28px] border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16 21 21" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-400">Ask Zota AI anything about services, hotels, halls, bookings, or trusted vendors...</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
                  <path d="M19 11a7 7 0 0 1-14 0" />
                  <path d="M12 18v3" />
                </svg>
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-950 text-white">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 12h13" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </div>
          </button>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {promptIdeas.map((prompt) => (
              <button
                key={prompt}
                onClick={() => openAssistant(prompt)}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {featuredCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => openAssistant(`Show me verified ${c.name.toLowerCase()} around me`)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
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
              <p className="text-base font-medium text-slate-950">Nearby services</p>
              <p className="mt-1 text-sm text-slate-500">
                {lat != null && lng != null ? "Location connected for smarter local results" : "Turn on location for nearby matches"}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              {lat != null && lng != null ? "Connected" : "Enable"}
            </span>
          </button>

          {nearbyPreview.length > 0 && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {nearbyPreview.map((vendor) => (
                <Link
                  key={vendor.id}
                  href={`/vendors/${vendor.id}?businessName=${encodeURIComponent(vendor.businessName ?? "Verified provider")}&serviceTitle=${encodeURIComponent("Open this vendor to request service")}&category=${encodeURIComponent("Nearby service")}&city=${encodeURIComponent(vendor.city ?? "Nearby")}`}
                  className="rounded-[22px] border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30"
                >
                  <h3 className="text-base font-semibold text-slate-950">{vendor.businessName ?? "Verified provider"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{vendor.city ?? "Nearby"} · {vendor.distanceKm}km away</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-medium text-slate-950">You might like</h2>
            <Link href="/bookings" className="text-sm font-medium text-emerald-900 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {(featuredVendorCards.length ? featuredVendorCards : visualCards).map((card) => (
              <Link
                key={card.id}
                href={"vendorId" in card ? buildVendorHref(card) : `/assistant?q=${encodeURIComponent(card.title)}`}
                className="relative min-h-[280px] min-w-[280px] overflow-hidden rounded-[28px] shadow-[0_24px_45px_rgba(15,23,42,0.18)]"
              >
                <img src={card.image} alt={card.title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.22)_36%,rgba(15,23,42,0.82)_100%)]" />
                <div className="absolute left-4 top-4 rounded-2xl bg-[#f9f34c] px-3 py-2 text-sm font-black text-slate-950 shadow">★ {card.rating}</div>
                <div className="relative flex h-full flex-col justify-end p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{card.badge}</p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{card.title}</h3>
                  <p className="mt-2 text-sm text-white/80">{card.subtitle}</p>
                  <span className="mt-4 inline-flex w-fit rounded-full bg-white/12 px-3 py-2 text-sm font-medium text-white">
                    Open service
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium text-slate-950">Must-do picks</h2>
              <p className="mt-1 text-sm text-slate-500">Useful bookings and services people request most.</p>
            </div>
            <Link href="/requests" className="text-sm font-medium text-emerald-900 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {(featuredBookingCards.length ? featuredBookingCards : visualCards.map((item) => ({
              id: item.id,
              title: item.title,
              subtitle: item.subtitle,
              type: item.id === "hotels" ? "HOTEL" : item.id === "services" ? "SERVICE" : "HALL",
              price: item.id === "hotels" ? "From NGN 75,000" : item.id === "services" ? "From NGN 10,000" : "From NGN 180,000",
              image: item.image,
            }))).map((item) => (
              <article key={item.id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
                <img src={item.image} alt={item.title} className="h-44 w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
                      {item.type}
                    </span>
                    <span className="rounded-full border border-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
                      Verified
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
                  {"price" in item && <p className="mt-3 text-sm font-medium text-slate-900">{item.price}</p>}
                  <button
                    className="mt-4 rounded-full bg-emerald-950 px-4 py-2 text-sm font-medium text-white"
                    onClick={() => openAssistant(item.title)}
                  >
                    Explore
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
