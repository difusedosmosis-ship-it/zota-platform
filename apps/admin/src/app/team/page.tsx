"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { requireRole } from "@/lib/route-guard";
import { readSession } from "@/lib/session";
import { useRouter } from "next/navigation";

const OFFICE_AREAS = ["OVERVIEW", "KYC", "CATALOG", "FINANCE", "TEAM", "MESSAGES", "NOTIFICATIONS"] as const;
type OfficeArea = (typeof OFFICE_AREAS)[number];

type ActivityRow = {
  id: string;
  action: string;
  route: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

type OfficeUser = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  officeTitle: string | null;
  officePermissions: OfficeArea[];
  isSuperAdmin: boolean;
  isDisabled: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  lastRoute: string | null;
  createdAt: string;
  recentActivity: ActivityRow[];
};

type OfficeUsersResponse = {
  ok: boolean;
  users: OfficeUser[];
};

function formatWhen(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

export default function OfficeUsersPage() {
  const router = useRouter();
  const session = readSession();
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [officeTitle, setOfficeTitle] = useState("");
  const [permissions, setPermissions] = useState<OfficeArea[]>(["OVERVIEW"]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const currentUserId = session?.user.id ?? null;
  const loadUsers = useCallback(async (silent = false) => {
    const res = await apiGet<OfficeUsersResponse>("/admin/users");
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(res.error ?? "Failed to load office accounts.");
    }
    setUsers(res.data.users);
    if (!silent) {
      setTone("success");
      setStatus(`Loaded ${res.data.users.length} office account(s).`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const officeSession = await requireRole(router, "ADMIN");
        if (!officeSession || cancelled) return;
        await loadUsers();
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadUsers, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadUsers(true);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadUsers]);

  const summary = useMemo(() => {
    const online = users.filter((user) => user.isOnline && !user.isDisabled).length;
    const disabled = users.filter((user) => user.isDisabled).length;
    const superAdmins = users.filter((user) => user.isSuperAdmin && !user.isDisabled).length;
    return { online, disabled, superAdmins };
  }, [users]);
  const canManageUsers = Boolean(session?.user.isSuperAdmin) || summary.superAdmins === 0;

  function resetForm() {
    setEditingUserId(null);
    setFullName("");
    setEmail("");
    setPassword("");
    setOfficeTitle("");
    setPermissions(["OVERVIEW"]);
    setIsSuperAdmin(false);
  }

  function togglePermission(area: OfficeArea) {
    setPermissions((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    );
  }

  function beginEdit(user: OfficeUser) {
    setEditingUserId(user.id);
    setFullName(user.fullName ?? "");
    setEmail(user.email ?? "");
    setPassword("");
    setOfficeTitle(user.officeTitle ?? "");
    setPermissions(user.officePermissions.length ? user.officePermissions : ["OVERVIEW"]);
    setIsSuperAdmin(user.isSuperAdmin);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitUser() {
    if (!fullName.trim() || !email.trim() || !officeTitle.trim()) {
      setTone("error");
      setStatus("Full name, office email, and job position are required.");
      return;
    }

    const officePermissions = isSuperAdmin ? [...OFFICE_AREAS] : permissions;
    if (!officePermissions.length) {
      setTone("error");
      setStatus("Assign at least one access area.");
      return;
    }

    setBusy(true);
    setTone("info");
    setStatus(editingUserId ? "Updating office account..." : "Creating office account...");

    const payload = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      officeTitle: officeTitle.trim(),
      officePermissions,
      isSuperAdmin,
    };

    const res = editingUserId
      ? await apiPatch<{ ok: boolean }>(`/admin/users/${editingUserId}`, {
          officeTitle: payload.officeTitle,
          officePermissions: payload.officePermissions,
          isSuperAdmin: payload.isSuperAdmin,
          isDisabled: false,
        })
      : await apiPost<{ ok: boolean }>("/admin/users", payload);

    setBusy(false);
    if (!res.ok) {
      setTone("error");
      setStatus(res.error ?? "Failed to save office account.");
      return;
    }

    resetForm();
    setTone("success");
    setStatus(editingUserId ? "Office account updated." : "Office account created.");
    await loadUsers(true);
  }

  async function removeUser(user: OfficeUser) {
    if (!canManageUsers) {
      setTone("error");
      setStatus("Only the super admin can remove office accounts.");
      return;
    }

    setBusyUserId(user.id);
    setTone("info");
    setStatus(`Removing ${user.fullName ?? user.email ?? "office user"}...`);
    const res = await apiDelete<{ ok: boolean }>(`/admin/users/${user.id}`);
    setBusyUserId(null);
    if (!res.ok) {
      setTone("error");
      setStatus(res.error ?? "Failed to remove office account.");
      return;
    }

    setTone("success");
    setStatus("Office account removed.");
    await loadUsers(true);
  }

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Office users</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Role-based internal access and staff control</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Create office operators, assign exact access areas, monitor their live activity, and remove access the moment a staff account should no longer operate inside Zota Office.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Office users online</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{summary.online}</p>
            <p className="mt-2 text-sm text-slate-500">Seen in the office within the last two minutes.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Disabled staff</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{summary.disabled}</p>
            <p className="mt-2 text-sm text-slate-500">Accounts removed from live office access.</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Super admins</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{summary.superAdmins}</p>
            <p className="mt-2 text-sm text-slate-500">Users with full office governance authority.</p>
          </article>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {editingUserId ? "Update office user" : "Create office user"}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {editingUserId ? "Adjust access, role, and authority" : "Issue a new internal office account"}
              </h3>
            </div>
            {editingUserId ? (
              <button className="bm-btn" onClick={resetForm}>Cancel edit</button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <input className="bm-input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="bm-input" type="email" placeholder="Office email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(editingUserId)} />
            <input className="bm-input" placeholder="Job position" value={officeTitle} onChange={(e) => setOfficeTitle(e.target.value)} />
            <input
              className="bm-input"
              type="password"
              placeholder={editingUserId ? "Leave blank to keep current password" : "Temporary password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={Boolean(editingUserId)}
            />
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={isSuperAdmin} onChange={(e) => setIsSuperAdmin(e.target.checked)} />
            Grant super admin authority
          </label>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Access areas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {OFFICE_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  disabled={isSuperAdmin}
                  onClick={() => togglePermission(area)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.12em] ${
                    isSuperAdmin || permissions.includes(area)
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {canManageUsers
                ? "Create office users, assign permissions, and revoke access directly from here."
                : "You can review office users here. Only the super admin can create, update, or remove office accounts."}
            </p>
            <button className="bm-btn bm-btn-primary" disabled={busy || !canManageUsers} onClick={submitUser}>
              {busy ? "Saving..." : editingUserId ? "Save office user" : "Create office user"}
            </button>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current office users</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Live staff visibility and control</h3>
            </div>
            <button className="bm-btn" onClick={() => void loadUsers()}>Refresh</button>
          </div>

          <div className="mt-5 space-y-4">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No office accounts created yet.</p>
            ) : (
              users.map((user) => (
                <article key={user.id} className="rounded-[24px] border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-950">{user.fullName ?? "Office operator"}</p>
                        {user.isSuperAdmin ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                            Super admin
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${user.isDisabled ? "border-rose-200 bg-rose-50 text-rose-700" : user.isOnline ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {user.isDisabled ? "Disabled" : user.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{user.email ?? user.phone ?? "No contact"}</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{user.officeTitle ?? "No job position"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {user.officePermissions.length ? (
                          user.officePermissions.map((area) => (
                            <span key={area} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              {area}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                            No active permissions
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canManageUsers ? (
                        <button className="bm-btn" onClick={() => beginEdit(user)} disabled={busyUserId === user.id}>
                          Edit
                        </button>
                      ) : null}
                      {canManageUsers && user.id !== currentUserId ? (
                        <button className="bm-btn bm-btn-warn" onClick={() => void removeUser(user)} disabled={busyUserId === user.id}>
                          {busyUserId === user.id ? "Removing..." : "Remove access"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <div className="rounded-[18px] bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Last seen</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{formatWhen(user.lastSeenAt)}</p>
                    </div>
                    <div className="rounded-[18px] bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Last login</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{formatWhen(user.lastLoginAt)}</p>
                    </div>
                    <div className="rounded-[18px] bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Last logout</p>
                      <p className="mt-2 text-sm font-medium text-slate-800">{formatWhen(user.lastLogoutAt)}</p>
                    </div>
                    <div className="rounded-[18px] bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Last route</p>
                      <p className="mt-2 break-all text-sm font-medium text-slate-800">{user.lastRoute ?? "No route captured"}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recent office activity</p>
                    <div className="mt-3 space-y-2">
                      {user.recentActivity.length === 0 ? (
                        <p className="text-sm text-slate-500">No activity captured for this office user yet.</p>
                      ) : (
                        user.recentActivity.map((row) => (
                          <div key={row.id} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{row.action.replaceAll("_", " ")}</p>
                              <p className="text-xs text-slate-400">{new Date(row.createdAt).toLocaleString()}</p>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{row.route ?? "No route recorded"}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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
