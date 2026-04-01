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
    coverageKm: number;
    isOnline: boolean;
    kycStatus: string;
    kycNote: string | null;
  };
};

export default function VendorKycPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Loading...");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  const [businessName, setBusinessName] = useState("BM Vendor Ltd");
  const [city, setCity] = useState("Lagos");
  const [coverageKm, setCoverageKm] = useState(10);
  const [isOnline, setIsOnline] = useState(true);
  const [kycStatus, setKycStatus] = useState("-");
  const [kycNote, setKycNote] = useState<string | null>(null);
  const [idDocUrl, setIdDocUrl] = useState("");
  const [ninNumber, setNinNumber] = useState("");
  const [businessDocUrl, setBusinessDocUrl] = useState("");
  const [skillProofUrl, setSkillProofUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  const loadVendor = useCallback(async () => {
    setTone("info");
    const res = await apiGet<VendorMeResponse>("/vendor/me");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(`Failed: ${res.error}`);
    }

    setBusinessName((prev) => res.data?.vendor.businessName ?? prev);
    setCity((prev) => res.data?.vendor.city ?? prev);
    setCoverageKm(res.data.vendor.coverageKm);
    setIsOnline(res.data.vendor.isOnline);
    setKycStatus(res.data.vendor.kycStatus);
    setKycNote(res.data.vendor.kycNote);
    setTone("success");
    setStatus("Vendor profile loaded.");
  }, []);

  async function saveProfile() {
    setTone("info");
    setStatus("Saving profile...");
    const res = await apiPatch<{ ok: boolean }>("/vendor/me", { businessName, city, coverageKm, isOnline });
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
      setStatus("Provide NIN number or ID upload, plus CAC/business document and skill certificate.");
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
      setTone("info");
      setStatus(`Uploading ${label}...`);

      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      const res = await fetch("/api/backend/vendor/kyc/upload", {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">Business Profile</h2>
          <input className="mt-4 w-full px-4 py-3 border border-gray-300 rounded-lg" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business Name" />
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" type="number" value={coverageKm} onChange={(e) => setCoverageKm(Number(e.target.value))} placeholder="Coverage (KM)" />
          <label className="mt-3 block text-gray-700"><input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} /> Online</label>
          <button className="mt-4 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={saveProfile}>Save Profile</button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">KYC Submission</h2>
          <p className="text-gray-600 mt-1 text-sm">Required: Business name, CAC/business document, NIN/ID, and skill certificate.</p>
          <p className="text-gray-600 mt-2">Current status: <span className="font-semibold">{kycStatus}</span></p>
          {kycNote && <p className="text-gray-600 mt-1">Note: {kycNote}</p>}

          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700">NIN Number (optional if ID document is uploaded)</label>
            <input className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg" value={ninNumber} onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit NIN number" />
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700">NIN / Government ID</label>
            <input className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg" value={idDocUrl} onChange={(e) => setIdDocUrl(e.target.value)} placeholder="Paste file URL or data URL" />
            <input
              className="mt-2 block w-full text-sm text-gray-600"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadKycFile(file, setIdDocUrl, "ID document");
              }}
            />
          </div>

          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700">CAC / Business Registration Certificate</label>
            <input className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg" value={businessDocUrl} onChange={(e) => setBusinessDocUrl(e.target.value)} placeholder="Paste file URL or data URL" />
            <input
              className="mt-2 block w-full text-sm text-gray-600"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadKycFile(file, setBusinessDocUrl, "Business document");
              }}
            />
          </div>

          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700">Skill Certificate / Portfolio Proof</label>
            <input className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg" value={skillProofUrl} onChange={(e) => setSkillProofUrl(e.target.value)} placeholder="Paste file URL or data URL" />
            <input
              className="mt-2 block w-full text-sm text-gray-600"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadKycFile(file, setSkillProofUrl, "Skill proof");
              }}
            />
          </div>

          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700">Selfie (optional)</label>
            <input className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg" value={selfieUrl} onChange={(e) => setSelfieUrl(e.target.value)} placeholder="Paste selfie URL or upload file" />
            <input
              className="mt-2 block w-full text-sm text-gray-600"
              type="file"
              accept="image/*"
              capture="user"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadKycFile(file, setSelfieUrl, "Selfie");
              }}
            />
          </div>

          <button className="mt-4 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={submitKyc}>Submit KYC</button>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
