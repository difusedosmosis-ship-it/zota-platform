"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/Shell";
import { StatusToast } from "@/components/StatusToast";
import { apiPost } from "@/lib/api";
import { type SessionUser, writeSession } from "@/lib/session";

type AuthResponse = { ok: boolean; user: SessionUser };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function friendlyError(error?: string) {
  if (!error) return "Something went wrong. Please try again.";
  const lower = error.toLowerCase();
  if (lower.includes("invalid email")) return "Enter a valid email address.";
  if (lower.includes("provide email or phone")) return "Email is required.";
  if (lower.includes("invalid credentials")) return "Incorrect email or password.";
  if (lower.includes("user already exists")) return "This email is already registered.";
  return error;
}

export default function VendorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Use your business email and password.");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState<null | "signup" | "login">(null);

  async function login() {
    const emailValue = email.trim().toLowerCase();
    if (!isValidEmail(emailValue)) {
      setTone("error");
      return setStatus("Enter a valid email address.");
    }
    if (!password.trim()) {
      setTone("error");
      return setStatus("Enter your password.");
    }

    setTone("info");
    setStatus("Signing in...");
    setBusy("login");
    const res = await apiPost<AuthResponse>("/api/session/login", { email: emailValue, password });
    if (!res.ok || !res.data) {
      setBusy(null);
      setTone("error");
      return setStatus(friendlyError(res.error));
    }
    writeSession({ user: res.data.user });
    setBusy(null);
    setTone("success");
    setStatus("Signed in. Redirecting...");
    window.location.assign("/dashboard");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Zota Business</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Login</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Access your business console, requests, wallet, and verification flow.</p>
          <input className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none" type="email" placeholder="Business email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          <input className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none" type="password" placeholder="Password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" defaultChecked className="rounded border-slate-300" />
              Remember me
            </label>
            <a className="font-semibold text-slate-700 underline underline-offset-4" href="mailto:support@zota.app?subject=Zota%20Business%20password%20reset">
              Forgot password?
            </a>
          </div>
          <div className="mt-5">
            <button disabled={busy !== null} className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60" onClick={login}>
              {busy === "login" ? "Signing in..." : "Login"}
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-600">{status}</p>
          <p className="mt-6 text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href={`/login?signup=1`}
              className="font-semibold text-slate-900 underline underline-offset-4"
              onClick={async (e) => {
                e.preventDefault();
                const emailValue = email.trim().toLowerCase();
                if (!isValidEmail(emailValue)) {
                  setTone("error");
                  setStatus("Enter a valid email address before creating an account.");
                  return;
                }
                if (!password.trim()) {
                  setTone("error");
                  setStatus("Enter a password before creating an account.");
                  return;
                }
                setTone("info");
                setBusy("signup");
                setStatus("Creating business account...");
                const res = await apiPost<AuthResponse>("/api/session/register", {
                  role: "VENDOR",
                  email: emailValue,
                  password,
                  fullName: emailValue.split("@")[0] || "Vendor User",
                });
                setBusy(null);
                if (!res.ok || !res.data) {
                  setTone("error");
                  setStatus(friendlyError(res.error));
                  return;
                }
                writeSession({ user: res.data.user });
                setTone("success");
                setStatus("Account created. Redirecting...");
                window.location.assign("/dashboard");
              }}
            >
              Sign up here
            </Link>
            .
          </p>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
