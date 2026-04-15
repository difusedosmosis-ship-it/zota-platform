"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";

type VendorMeResponse = {
  ok: boolean;
  vendor: {
    businessName: string | null;
    city: string | null;
    isOnline: boolean;
    kycStatus: string;
    kycNote: string | null;
  };
};

export default function VendorKycPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [kycStatus, setKycStatus] = useState("-");
  const [kycNote, setKycNote] = useState<string | null>(null);
  const [idDocUrl, setIdDocUrl] = useState("");
  const [ninNumber, setNinNumber] = useState("");
  const [businessDocUrl, setBusinessDocUrl] = useState("");
  const [skillProofUrl, setSkillProofUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);

  function proxyUrl(path: string) {
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  }

  const loadVendor = useCallback(async () => {
    const res = await apiGet<VendorMeResponse>("/vendor/me");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }

    setBusinessName((prev) => res.data?.vendor.businessName ?? prev);
    setCity((prev) => res.data?.vendor.city ?? prev);
    setIsOnline(res.data.vendor.isOnline);
    setKycStatus(res.data.vendor.kycStatus);
    setKycNote(res.data.vendor.kycNote);
    setTone("info");
    setStatus("");
  }, []);

  async function saveProfile() {
    setTone("info");
    setStatus("Saving profile...");
    const res = await apiPatch<{ ok: boolean }>("/vendor/me", { businessName, city, isOnline });
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setTone("success");
    setStatus("Profile saved.");
    await loadVendor();
  }

  async function submitKyc() {
    if ((!idDocUrl && !ninNumber) || !businessDocUrl || !skillProofUrl) {
      setTone("error");
      setStatus("Provide NIN number or ID upload, plus proof of address. Business registration certificate is optional.");
      return;
    }

    setTone("info");
    setStatus("Submitting KYC...");
    const res = await apiPost<{ ok: boolean }>("/vendor/kyc/submit", {
      idDocUrl: idDocUrl || undefined,
      ninNumber: ninNumber || undefined,
      businessDocUrl,
      skillProofUrl,
      selfieUrl: selfieUrl || undefined,
    });
    if (!res.ok) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }
    setTone("success");
    setStatus("KYC submitted for review.");
    await loadVendor();
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

  async function uploadKycFile(file: File, setter: (v: string) => void, label: string) {
    try {
      setUploading(label);
      setTone("info");
      setStatus(`Uploading ${label}...`);

      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      const res = await fetch(proxyUrl("/api/backend/vendor/kyc/upload"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64,
        }),
      });

      const data = (await res.json()) as { ok: boolean; url?: string; message?: string };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.message ?? "Upload failed");
      }

      setter(data.url);
      setTone("success");
      setStatus(`${label} uploaded.`);
    } catch (e: unknown) {
      setTone("error");
      setStatus(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await requireRole(router, "VENDOR");
      if (!session || cancelled) return;
      await loadVendor();
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadVendor]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">KYC & trust</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Verification centre</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Keep business identity, service proof, and profile readiness in one place so customers and payouts trust your account.
              </p>
            </div>
            <div className="rounded-[22px] bg-slate-50 px-4 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current status</p>
              <p className="mt-1 font-bold text-slate-950">{kycStatus}</p>
              {kycNote && <p className="mt-2 text-slate-500">{kycNote}</p>}
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Business profile</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Public operating details</h2>

            <div className="mt-4 grid gap-3">
              <input className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" />
              <input className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Business address / operation area" />
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
                Accept new customer demand right now
              </label>
            </div>

            <button className="mt-5 rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white" onClick={saveProfile}>Save business profile</button>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Verification evidence</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Submit compliance files</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Required: means of ID or NIN, plus proof of address. Business registration certificate is optional for skilled workers without registered businesses.</p>

            <div className="mt-4 grid gap-4">
              <div className="rounded-[24px] border border-slate-200 p-4">
                <label className="text-sm font-semibold text-slate-900">NIN number</label>
                <input className="mt-3 w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none" inputMode="numeric" value={ninNumber} onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit NIN number" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-dashed border-slate-200 p-4">
                  <label className="text-sm font-semibold text-slate-900">NIN / Government ID</label>
                  <input className="mt-3 block w-full min-w-0 text-base text-slate-600" type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadKycFile(file, setIdDocUrl, "ID document");
                  }} />
                  <p className="mt-3 text-xs text-slate-500">{idDocUrl ? "Uploaded successfully." : uploading === "ID document" ? "Uploading..." : "Use camera or files."}</p>
                </div>

                <div className="rounded-[24px] border border-dashed border-slate-200 p-4">
                  <label className="text-sm font-semibold text-slate-900">Business registration certificate (optional)</label>
                  <input className="mt-3 block w-full min-w-0 text-base text-slate-600" type="file" accept="image/*,.pdf" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadKycFile(file, setBusinessDocUrl, "Business document");
                  }} />
                  <p className="mt-3 text-xs text-slate-500">{businessDocUrl ? "Document ready." : uploading === "Business document" ? "Uploading..." : "Upload from files if available."}</p>
                </div>

                <div className="rounded-[24px] border border-dashed border-slate-200 p-4">
                  <label className="text-sm font-semibold text-slate-900">Proof of address</label>
                  <input className="mt-3 block w-full min-w-0 text-base text-slate-600" type="file" accept="image/*,.pdf" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadKycFile(file, setSkillProofUrl, "Proof of address");
                  }} />
                  <p className="mt-3 text-xs text-slate-500">{skillProofUrl ? "Document ready." : uploading === "Proof of address" ? "Uploading..." : "Upload utility bill, tenancy proof, or similar."}</p>
                </div>

                <div className="rounded-[24px] border border-dashed border-slate-200 p-4">
                  <label className="text-sm font-semibold text-slate-900">Selfie (optional)</label>
                  <input className="mt-3 block w-full min-w-0 text-base text-slate-600" type="file" accept="image/*" capture="user" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadKycFile(file, setSelfieUrl, "Selfie");
                  }} />
                  <p className="mt-3 text-xs text-slate-500">{selfieUrl ? "Uploaded successfully." : uploading === "Selfie" ? "Uploading..." : "Use camera or files."}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col items-start gap-2">
              <button className="rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={uploading !== null} onClick={submitKyc}>
                {uploading ? `Uploading ${uploading}...` : "Submit KYC"}
              </button>
              {status ? <p className={`text-sm ${tone === "error" ? "text-rose-600" : "text-slate-500"}`}>{status}</p> : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
