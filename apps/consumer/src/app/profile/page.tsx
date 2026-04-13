"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiDelete } from "@/lib/api";
import { clearSession, readSession } from "@/lib/session";
import { requireRole } from "@/lib/route-guard";

export default function ProfilePage() {
  const router = useRouter();
  const session = readSession();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  useEffect(() => {
    void requireRole(router, "CONSUMER");
  }, [router]);

  async function deleteAccount() {
    const confirmed = window.confirm("Delete this Zota account permanently? This cannot be undone.");
    if (!confirmed) return;
    setTone("info");
    setStatus("Deleting account...");
    const res = await apiDelete<{ ok: boolean }>("/users/me");
    if (!res.ok) {
      setTone("error");
      return setStatus(res.error ?? "Delete failed");
    }
    clearSession();
    await fetch("/api/session/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function logout() {
    clearSession();
    fetch("/api/session/logout", { method: "POST" }).finally(() => {
      window.location.href = "/login";
    });
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-gray-600 mt-1">Manage your Zota account, notifications, and account actions.</p>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-700">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Login email</p>
            <p className="mt-2 text-base font-semibold text-gray-900">{session?.user.email ?? "Not set"}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-700">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Password recovery</p>
            <a className="mt-2 inline-flex font-semibold text-gray-900 underline underline-offset-4" href="mailto:support@zota.app?subject=Zota%20password%20reset">
              Forgot password?
            </a>
            <div className="mt-4">
              <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Danger zone</p>
            <p className="mt-2">Delete this account and remove your Zota consumer profile.</p>
            <button className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white" onClick={deleteAccount}>
              Delete account
            </button>
          </div>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
