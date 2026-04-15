"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { ZotaLogo } from "@/components/ZotaLogo";
import { apiPost } from "@/lib/api";
import { type SessionUser, writeSession } from "@/lib/session";

type AuthResponse = { ok: boolean; user: SessionUser };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function friendlyError(error?: string) {
  if (!error) return "Something went wrong. Please try again.";
  const lower = error.toLowerCase();
  if (lower.includes("invalid email")) return "Enter a valid office email address.";
  if (lower.includes("provide email or phone")) return "Office email is required.";
  if (lower.includes("invalid credentials")) return "Incorrect email or password.";
  if (lower.includes("user already exists")) return "This office email is already registered.";
  return error;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);

  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Sign into the office to review verification, finance, and platform operations."
        : "Create the first office account or register a new admin operator.",
    [mode],
  );

  async function submit() {
    const emailValue = email.trim().toLowerCase();
    if (!isValidEmail(emailValue)) {
      setTone("error");
      setStatus("Enter a valid office email address.");
      return;
    }
    if (!password.trim()) {
      setTone("error");
      setStatus("Enter a password.");
      return;
    }

    setBusy(true);
    setTone("info");
    setStatus(mode === "login" ? "Signing in..." : "Creating office account...");

    const res =
      mode === "login"
        ? await apiPost<AuthResponse>("/api/session/login", { email: emailValue, password })
        : await apiPost<AuthResponse>("/api/session/register", {
            role: "ADMIN",
            email: emailValue,
            password,
            fullName: "Office Admin",
          });

    setBusy(false);
    if (!res.ok || !res.data) {
      setTone("error");
      setStatus(friendlyError(res.error));
      return;
    }

    writeSession({ user: res.data.user });
    router.push("/dashboard");
  }

  return (
    <AppShell>
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-6">
        <section className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(145deg,#050816_0%,#0b1220_55%,#111827_100%)] p-8 text-white shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
          <ZotaLogo size={48} showWordmark={false} />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">Zota Office</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            Operate the marketplace from one professional control surface.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Review verification, govern categories, supervise finance, and keep Zota Consumer and Zota Business running cleanly.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Verification</p>
              <p className="mt-2 text-lg font-semibold text-white">KYC Queue</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Finance</p>
              <p className="mt-2 text-lg font-semibold text-white">Vendor balances</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Governance</p>
              <p className="mt-2 text-lg font-semibold text-white">Categories and trust</p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            {mode === "login" ? "Office Sign In" : "Office Sign Up"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
            {mode === "login" ? "Sign into Zota Office" : "Create an office account"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>

          <div className="mt-6 space-y-4">
            <input className="bm-input" type="email" placeholder="Office email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="bm-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="bm-btn bm-btn-primary" disabled={busy} onClick={submit}>
              {busy ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Login" : "Create office account"}
            </button>
            <a className="text-sm font-semibold text-emerald-700" href="mailto:support@zota.app?subject=Zota%20Office%20password%20reset">
              Forgot password?
            </a>
          </div>

          <p className="mt-5 text-sm text-slate-500">
            {mode === "login" ? "No office account yet? " : "Already have an office account? "}
            <button className="font-semibold text-slate-950" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Create one here" : "Sign in here"}
            </button>
          </p>
        </section>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
