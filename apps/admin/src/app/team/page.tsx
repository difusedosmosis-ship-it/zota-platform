"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiGet, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";
import { useRouter } from "next/navigation";

type OfficeUser = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  createdAt: string;
};

type OfficeUsersResponse = {
  ok: boolean;
  users: OfficeUser[];
};

export default function OfficeUsersPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loadUsers = useCallback(async () => {
    const res = await apiGet<OfficeUsersResponse>("/admin/users");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to load office accounts.");
    }
    setUsers(res.data.users);
    setTone("success");
    setStatus(`Loaded ${res.data.users.length} office account(s).`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const session = await requireRole(router, "ADMIN");
        if (!session || cancelled) return;
        await loadUsers();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadUsers, router]);

  async function createUser() {
    if (!fullName.trim() || !email.trim() || password.trim().length < 8) {
      setTone("error");
      setStatus("Full name, office email, and an 8-character password are required.");
      return;
    }

    setBusy(true);
    setTone("info");
    setStatus("Creating office account...");
    const res = await apiPost<{ ok: boolean }>("/admin/users", {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (!res.ok) {
      setTone("error");
      setStatus(res.error ?? "Failed to create office account.");
      return;
    }

    setFullName("");
    setEmail("");
    setPassword("");
    setTone("success");
    setStatus("Office account created.");
    await loadUsers();
  }

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Office operators</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Create and manage internal office accounts</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Zota Office is not public. New office operators are created from inside the admin system and issued their login credentials here.
          </p>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="grid gap-4 md:grid-cols-3">
            <input className="bm-input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="bm-input" type="email" placeholder="Office email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="bm-input" type="password" placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Create office accounts here, then share credentials securely with the assigned office operator.</p>
            <button className="bm-btn bm-btn-primary" disabled={busy} onClick={createUser}>
              {busy ? "Creating..." : "Create office account"}
            </button>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current office accounts</p>
          <div className="mt-4 space-y-3">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No office accounts created yet.</p>
            ) : (
              users.map((user) => (
                <article key={user.id} className="rounded-[22px] border border-slate-200 p-4">
                  <p className="font-semibold text-slate-950">{user.fullName ?? "Office operator"}</p>
                  <p className="mt-1 text-sm text-slate-500">{user.email ?? user.phone ?? "No contact"}</p>
                  <p className="mt-2 text-xs text-slate-400">Created {new Date(user.createdAt).toLocaleString()}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
