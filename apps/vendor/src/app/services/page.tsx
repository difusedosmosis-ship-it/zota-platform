"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
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
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [categories, setCategories] = useState<CategoriesResponse["categories"]>([]);
  const [services, setServices] = useState<ServicesResponse["services"]>([]);
  const [bookingListings, setBookingListings] = useState<BookingListing[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [pricingType, setPricingType] = useState("from");
  const [priceFrom, setPriceFrom] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryImageUrls, setGalleryImageUrls] = useState<string[]>([]);

  const [bookingKind, setBookingKind] = useState<"HOTEL" | "CAR" | "HALL">("HOTEL");
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingCity, setBookingCity] = useState("");
  const [bookingPrice, setBookingPrice] = useState("");

  const physicalCategories = categories.filter((c) => c.kind === "PHYSICAL");

  async function loadCategories() {
    const res = await apiGet<CategoriesResponse>("/categories");
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }
    setCategories(res.data.categories);
    if (!categoryId) {
      const firstPhysical = res.data.categories.find((c) => c.kind === "PHYSICAL");
      if (firstPhysical) setCategoryId(firstPhysical.id);
    }
  }

  async function loadServices() {
    const res = await apiGet<ServicesResponse>("/vendor/services");
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }
    setServices(res.data.services);
  }

  async function loadBookingListings() {
    const res = await apiGet<BookingListingsResponse>("/booking/vendor/listings");
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }
    setBookingListings(res.data.listings);
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

  async function createService() {
    if (!categoryId || !serviceTitle.trim()) {
      setTone("error");
      setStatus("Select a category and enter a service title.");
      return;
    }

    setTone("info");
    setStatus("Publishing service...");
    const res = await apiPost<{ ok: boolean }>("/vendor/services", {
      categoryId,
      title: serviceTitle.trim(),
      pricingType,
      priceFrom: priceFrom ? Number(priceFrom) : undefined,
      coverImageUrl: coverImageUrl || undefined,
      galleryImageUrls,
      isActive: true,
    });
    if (!res.ok) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }

    setTone("success");
    setStatus("Service published.");
    setServiceTitle("");
    setPriceFrom("");
    setCoverImageUrl("");
    setGalleryImageUrls([]);
    await loadServices();
  }

  async function createBookingListing() {
    if (!bookingTitle.trim()) {
      setTone("error");
      setStatus("Enter an asset title.");
      return;
    }
    if (!bookingPrice) {
      setTone("error");
      setStatus("Enter an asset price.");
      return;
    }

    setTone("info");
    setStatus("Creating asset...");
    const res = await apiPost<{ ok: boolean }>("/booking/vendor/listings", {
      kind: bookingKind,
      title: bookingTitle.trim(),
      description: bookingTitle.trim(),
      city: bookingCity.trim() || undefined,
      provider: "LOCAL",
      pricePerDay: Number(bookingPrice),
      currency: "NGN",
      isActive: true,
    });
    if (!res.ok) {
      setTone("error");
      setStatus(`Failed: ${res.error}`);
      return;
    }

    setTone("success");
    setStatus("Asset created.");
    setBookingTitle("");
    setBookingCity("");
    setBookingPrice("");
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
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Services & assets</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Build your business catalog</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Publish services and reserve-now assets cleanly so the consumer app can discover the business without noisy demo content.
              </p>
            </div>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => void Promise.all([loadServices(), loadBookingListings()])}>
              Refresh catalog
            </button>
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Service publishing</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Create a service</h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {physicalCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" value={pricingType} onChange={(e) => setPricingType(e.target.value)}>
                <option value="from">From pricing</option>
                <option value="fixed">Fixed pricing</option>
                <option value="quote">Quote only</option>
              </select>
              <input className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none md:col-span-2" value={serviceTitle} onChange={(e) => setServiceTitle(e.target.value)} placeholder="Service title" />
              <input className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" type="number" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} placeholder="Price" />
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Add a cover image and up to five gallery images to improve trust and conversion.
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-dashed border-slate-200 p-4">
                <label className="text-sm font-semibold text-slate-900">Cover image</label>
                <input
                  className="mt-3 block w-full min-w-0 text-base text-slate-600"
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
                {coverImageUrl ? <p className="mt-3 text-xs text-emerald-700">Cover ready.</p> : null}
              </div>

              <div className="rounded-[24px] border border-dashed border-slate-200 p-4">
                <label className="text-sm font-semibold text-slate-900">Gallery images</label>
                <input
                  className="mt-3 block w-full min-w-0 text-base text-slate-600"
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
                {galleryImageUrls.length > 0 ? <p className="mt-3 text-xs text-emerald-700">{galleryImageUrls.length} gallery image(s) ready.</p> : null}
              </div>
            </div>

            <div className="mt-5 flex flex-col items-start gap-2">
              <button className="rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white" onClick={createService}>Publish service</button>
              {status ? <p className={`text-sm ${tone === "error" ? "text-rose-600" : "text-slate-500"}`}>{status}</p> : null}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Reserve-now inventory</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Create asset</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Hotels, halls, rentals, and other reserve-now inventory should live here.</p>

            <div className="mt-4 grid gap-3">
              <select className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" value={bookingKind} onChange={(e) => setBookingKind(e.target.value as "HOTEL" | "CAR" | "HALL") }>
                <option value="HOTEL">Hotel</option>
                <option value="CAR">Car Rental</option>
                <option value="HALL">Event Hall</option>
              </select>
              <input className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" value={bookingTitle} onChange={(e) => setBookingTitle(e.target.value)} placeholder="Asset title" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" value={bookingCity} onChange={(e) => setBookingCity(e.target.value)} placeholder="Operation area / city" />
                <input className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" type="number" value={bookingPrice} onChange={(e) => setBookingPrice(e.target.value)} placeholder="Price per day" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white" onClick={createBookingListing}>Create asset</button>
              <button className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={loadBookingListings}>Refresh assets</button>
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Published services</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Service catalog</h2>
              </div>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">{services.length} live</span>
            </div>
            <div className="mt-4 space-y-3">
              {services.length === 0 ? (
                <div className="rounded-[22px] bg-slate-50 p-4 text-sm leading-6 text-slate-500">No services yet. Publish one to start receiving direct marketplace leads.</div>
              ) : (
                services.map((s) => (
                  <article key={s.id} className="rounded-[24px] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{s.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">{s.category.name}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
                        {s.pricingType}{s.priceFrom ? ` · NGN ${s.priceFrom.toLocaleString()}` : ""}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Reserve-now inventory</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Assets</h2>
              </div>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">{bookingListings.length} live</span>
            </div>
            <div className="mt-4 space-y-3">
              {bookingListings.length === 0 ? (
                <div className="rounded-[22px] bg-slate-50 p-4 text-sm leading-6 text-slate-500">No assets yet. Add one so customers can book directly from search results.</div>
              ) : (
                bookingListings.map((b) => (
                  <article key={b.id} className="rounded-[24px] border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{b.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">{b.kind} · {b.city ?? "No city set"}</p>
                      </div>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
                        {b.currency} {b.pricePerDay.toLocaleString()}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
