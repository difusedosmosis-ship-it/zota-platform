"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { apiGet } from "@/lib/api";

type Category = { id: string; name: string; kind: string };
type CategoriesResponse = { ok: boolean; categories: Category[] };

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

type FeaturedVendorResponse = { ok: boolean; vendors: FeaturedVendor[] };

type BookingListing = {
  id: string;
  kind: string;
  title: string;
  city: string | null;
  currency: string;
  pricePerDay: number;
};
type BookingListingResponse = { ok: boolean; listings: BookingListing[] };

type TopTab = "search_all" | "hotels" | "services" | "bookings";

const constTab = {
  search_all: { label: "Search All", icon: "⌂" },
  hotels: { label: "Hotels", icon: "⌘" },
  services: { label: "Artisans", icon: "◍" },
  bookings: { label: "Bookings", icon: "◈" },
} as const;

const bookingOptions = ["Flights", "Car Rentals", "Event Halls", "Daily Deals"];

export default function ConsumerLandingPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TopTab>("search_all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showBookingMenu, setShowBookingMenu] = useState(false);
  const [bookingSelection, setBookingSelection] = useState("Flights");

  const [locationLabel, setLocationLabel] = useState("Detecting your location...");
  const [featuredVendors, setFeaturedVendors] = useState<FeaturedVendor[]>([]);
  const [featuredBookings, setFeaturedBookings] = useState<BookingListing[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  async function loadLandingData() {
    const [catRes, vendorRes, bookingRes] = await Promise.all([
      apiGet<CategoriesResponse>("/categories"),
      apiGet<FeaturedVendorResponse>("/vendor/featured?city=Lagos&limit=8"),
      apiGet<BookingListingResponse>("/booking/public/listings?city=Lagos&limit=8"),
    ]);

    if (catRes.ok && catRes.data) setAllCategories(catRes.data.categories);
    if (vendorRes.ok && vendorRes.data) setFeaturedVendors(vendorRes.data.vendors);
    if (bookingRes.ok && bookingRes.data) setFeaturedBookings(bookingRes.data.listings);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLandingData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!navigator.geolocation) {
        setLocationLabel("Location unavailable");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationLabel(`Near ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
        },
        () => setLocationLabel("Enable location for nearby results"),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const placeholder = useMemo(() => {
    if (activeTab === "hotels") return "Search hotels, stays, and shortlets...";
    if (activeTab === "services") return "Search plumber, electrician, mechanic...";
    if (activeTab === "bookings") return `Search ${bookingSelection.toLowerCase()}...`;
    return "Places to go, services to book, hotels, flights...";
  }, [activeTab, bookingSelection]);

  const serviceHighlights = useMemo(() => {
    const source = allCategories.filter((c) => c.kind === "PHYSICAL").map((c) => c.name);
    return source.length
      ? source.slice(0, 10)
      : ["Plumber", "Electrician", "Mechanic", "Cleaning", "AC Repair", "Generator Repair"];
  }, [allCategories]);

  function runSearch(query?: string) {
    const q = (query ?? searchQuery).trim();
    if (!q) return;
    if (activeTab === "hotels" || activeTab === "bookings") {
      router.push(`/bookings?q=${encodeURIComponent(q)}`);
      return;
    }
    router.push(`/dashboard?q=${encodeURIComponent(q)}`);
  }

  return (
    <AppShell>
      <div className="w-full bg-[#f5f6f7] pb-24">
        <section className="max-w-5xl mx-auto px-4 pt-6">
          <p className="text-xs text-slate-500 mb-4">{locationLabel}</p>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(constTab) as TopTab[]).map((key) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveTab(key);
                      setShowBookingMenu(false);
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                      active
                        ? "bg-emerald-50 text-emerald-800 border-emerald-500"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    <span className="mr-2">{constTab[key].icon}</span>
                    {constTab[key].label}
                  </button>
                );
              })}
            </div>

            {activeTab === "bookings" && (
              <div className="mt-3 relative">
                <button
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700"
                  onClick={() => setShowBookingMenu((v) => !v)}
                >
                  Booking Type: {bookingSelection}
                </button>
                {showBookingMenu && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                    {bookingOptions.map((opt) => (
                      <button
                        key={opt}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-sm"
                        onClick={() => {
                          setBookingSelection(opt);
                          setShowBookingMenu(false);
                          setSearchQuery(opt);
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <span>🔎</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder={placeholder}
                  className="w-full bg-transparent py-1.5 text-base text-slate-900 placeholder:text-slate-400 outline-none"
                />
              </div>
              <div className="h-px bg-slate-200 my-3" />
              <button
                onClick={() => runSearch()}
                className="w-full rounded-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 text-lg"
              >
                Search
              </button>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 mt-7">
          <h2 className="text-xl font-bold text-slate-900">Top Categories</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {serviceHighlights.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSearchQuery(cat);
                  setActiveTab("services");
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-emerald-400"
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 mt-8">
          <h2 className="text-xl font-bold text-slate-900">Trending Around You</h2>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {featuredBookings.slice(0, 2).map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setActiveTab("bookings");
                  setSearchQuery(b.title);
                  runSearch(b.title);
                }}
                className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-400"
              >
                <p className="text-xs text-emerald-700 font-semibold">{b.kind}</p>
                <p className="mt-1 font-semibold text-slate-900 line-clamp-2">{b.title}</p>
                <p className="text-sm text-slate-500 mt-1">{b.city ?? "-"} · {b.currency} {b.pricePerDay}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 mt-8">
          <h2 className="text-xl font-bold text-slate-900">Verified Providers</h2>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {featuredVendors.map((v) => (
              <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                {v.services[0]?.coverImageUrl && (
                  <Image
                    src={v.services[0].coverImageUrl}
                    alt={v.services[0].title}
                    width={900}
                    height={700}
                    className="w-full h-36 object-cover rounded-xl"
                  />
                )}
                <p className="mt-3 font-semibold text-slate-900">{v.businessName ?? "Verified Vendor"}</p>
                <p className="text-sm text-slate-500">{v.city ?? "-"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.services.map((s) => (
                    <span key={s.id} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                      {s.category.name}
                    </span>
                  ))}
                </div>
                <div className="mt-3">
                  <Link
                    href={`/messages?vendorId=${encodeURIComponent(v.id)}${v.services[0] ? `&serviceId=${encodeURIComponent(v.services[0].id)}` : ""}`}
                    className="inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
                  >
                    Message Vendor
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
