"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type CategoriesResponse = { ok: boolean; categories: Array<{ id: string; name: string; kind: string }> };
type ServicesResponse = {
  ok: boolean;
  services: Array<{
    id: string;
    title: string;
    pricingType: string;
    priceFrom: number | null;
    coverImageUrl?: string | null;
    galleryImageUrls?: string[];
    category: { name: string };
  }>;
};
type BookingListing = {
  id: string;
  kind: "HOTEL" | "CAR" | "HALL" | "FLIGHT";
  title: string;
  city: string | null;
  pricePerDay: number;
  currency: string;
  isActive: boolean;
};
type BookingListingsResponse = {
  ok: boolean;
  listings: BookingListing[];
};

export default function VendorServicesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Loading...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [categories, setCategories] = useState<CategoriesResponse["categories"]>([]);
  const [services, setServices] = useState<ServicesResponse["services"]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [serviceTitle, setServiceTitle] = useState("General Plumbing");
  const [pricingType, setPricingType] = useState("from");
  const [priceFrom, setPriceFrom] = useState(10000);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryImageUrls, setGalleryImageUrls] = useState<string[]>([]);
  const [bookingKind, setBookingKind] = useState<"HOTEL" | "CAR" | "HALL">("HOTEL");
  const [bookingTitle, setBookingTitle] = useState("Lagos Premium Suites");
  const [bookingCity, setBookingCity] = useState("Lagos");
  const [bookingPrice, setBookingPrice] = useState(75000);
  const [bookingListings, setBookingListings] = useState<BookingListing[]>([]);
  const physicalCategories = categories.filter((c) => c.kind === "PHYSICAL");

  async function loadCategories() {
    setTone("info");
    const res = await apiGet<CategoriesResponse>("/categories");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setCategories(res.data.categories);
    if (!categoryId && res.data.categories[0]) {
      const firstPhysical = res.data.categories.find((c) => c.kind === "PHYSICAL");
      if (firstPhysical) setCategoryId(firstPhysical.id);
    }
    setTone("success");
    setStatus("Categories loaded.");
  }

  async function loadServices() {
    setTone("info");
    const res = await apiGet<ServicesResponse>("/vendor/services");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setServices(res.data.services);
    setTone("success");
    setStatus("Services loaded.");
  }

  async function createService() {
    setTone("info");
    setStatus("Publishing service...");
    const res = await apiPost<{ ok: boolean }>("/vendor/services", {
      categoryId,
      title: serviceTitle,
      pricingType,
      priceFrom,
      coverImageUrl: coverImageUrl || undefined,
      galleryImageUrls,
      isActive: true,
    });
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setTone("success");
    setStatus("Service published.");
    setCoverImageUrl("");
    setGalleryImageUrls([]);
    await loadServices();
  }

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  async function uploadServiceImage(file: File) {
    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const res = await fetch("/api/backend/vendor/services/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        base64,
      }),
    });
    const data = (await res.json()) as { ok: boolean; url?: string; message?: string };
    if (!res.ok || !data.ok || !data.url) throw new Error(data.message ?? "Upload failed");
    return data.url;
  }

  async function loadBookingListings() {
    setTone("info");
    const res = await apiGet<BookingListingsResponse>("/booking/vendor/listings");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setBookingListings(res.data.listings);
    setTone("success");
    setStatus("Booking listings loaded.");
  }

  async function createBookingListing() {
    setTone("info");
    setStatus("Creating booking listing...");
    const res = await apiPost<{ ok: boolean }>("/booking/vendor/listings", {
      kind: bookingKind,
      title: bookingTitle,
      description: `${bookingTitle} booking listing`,
      city: bookingCity,
      provider: "LOCAL",
      pricePerDay: bookingPrice,
      currency: "NGN",
      isActive: true,
    });
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setTone("success");
    setStatus("Booking listing created.");
    await loadBookingListings();
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "VENDOR");
        if (!session || cancelled) return;
        await Promise.all([loadCategories(), loadServices(), loadBookingListings()]);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">Create Service Listing</h2>
          <select className="mt-4 w-full px-4 py-3 border border-gray-300 rounded-lg" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select category</option>
            {physicalCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="Service title" />
          <select className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" value={pricingType} onChange={(e) => setPricingType(e.target.value)}>
            <option value="from">from</option>
            <option value="fixed">fixed</option>
            <option value="quote">quote</option>
          </select>
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" type="number" value={priceFrom} onChange={(e) => setPriceFrom(Number(e.target.value))} placeholder="Price" />
          <label className="mt-3 block text-sm font-medium text-gray-700">Cover image</label>
          <input
            className="mt-1 block w-full text-sm text-gray-600"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setStatus("Uploading cover image...");
              setTone("info");
              void uploadServiceImage(file)
                .then((url) => {
                  setCoverImageUrl(url);
                  setStatus("Cover uploaded.");
                  setTone("success");
                })
                .catch((err: unknown) => {
                  setStatus(err instanceof Error ? err.message : "Cover upload failed");
                  setTone("error");
                });
            }}
          />
          {coverImageUrl && <p className="mt-1 text-xs text-indigo-700 truncate">{coverImageUrl}</p>}

          <label className="mt-3 block text-sm font-medium text-gray-700">Gallery images (max 5)</label>
          <input
            className="mt-1 block w-full text-sm text-gray-600"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 5);
              if (!files.length) return;
              setStatus("Uploading gallery...");
              setTone("info");
              void Promise.all(files.map((f) => uploadServiceImage(f)))
                .then((urls) => {
                  setGalleryImageUrls(urls.slice(0, 5));
                  setStatus("Gallery uploaded.");
                  setTone("success");
                })
                .catch((err: unknown) => {
                  setStatus(err instanceof Error ? err.message : "Gallery upload failed");
                  setTone("error");
                });
            }}
          />
          {galleryImageUrls.length > 0 && <p className="mt-1 text-xs text-indigo-700">{galleryImageUrls.length} gallery image(s) ready.</p>}
          <button className="mt-4 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={createService}>Publish Service</button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">My Services</h2>
          {services.length === 0 ? (
            <p className="text-gray-600 mt-3">No services yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-gray-700">
              {services.map((s) => (
                <li key={s.id} className="border border-gray-200 rounded-lg px-3 py-2">
                  {s.title} - {s.category.name} ({s.pricingType}{s.priceFrom ? `: ${s.priceFrom}` : ""})
                  {s.coverImageUrl && <p className="text-xs text-indigo-700 truncate mt-1">Cover: {s.coverImageUrl}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">Create Booking Asset</h2>
          <p className="text-gray-600 mt-1">For hotels, car rentals, and event halls.</p>
          <select className="mt-4 w-full px-4 py-3 border border-gray-300 rounded-lg" value={bookingKind} onChange={(e) => setBookingKind(e.target.value as "HOTEL" | "CAR" | "HALL")}>
            <option value="HOTEL">Hotel</option>
            <option value="CAR">Car Rental</option>
            <option value="HALL">Event Hall</option>
          </select>
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" value={bookingTitle} onChange={(e) => setBookingTitle(e.target.value)} placeholder="Listing title" />
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" value={bookingCity} onChange={(e) => setBookingCity(e.target.value)} placeholder="City" />
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" type="number" value={bookingPrice} onChange={(e) => setBookingPrice(Number(e.target.value))} placeholder="Price per day" />
          <div className="mt-4 flex gap-3">
            <button className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={createBookingListing}>Create Asset</button>
            <button className="px-5 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold" onClick={loadBookingListings}>Refresh</button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 md:col-span-2">
          <h2 className="text-xl font-bold text-gray-900">My Booking Assets</h2>
          {bookingListings.length === 0 ? (
            <p className="text-gray-600 mt-3">No booking assets yet.</p>
          ) : (
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              {bookingListings.map((b) => (
                <div key={b.id} className="border border-gray-200 rounded-lg px-3 py-2">
                  <p className="font-semibold text-gray-900">{b.title}</p>
                  <p className="text-sm text-gray-500">{b.kind} · {b.city ?? "-"} · {b.currency} {b.pricePerDay}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
