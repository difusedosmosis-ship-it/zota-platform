"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ConsumerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Enter your details to login or create an account.");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState<null | "signup" | "login">(null);

  async function signup() {
    const emailValue = email.trim().toLowerCase();
    if (!isValidEmail(emailValue)) {
      setTone("error");
      return setStatus("Enter a valid email address.");
    }

    setTone("info");
    setStatus("Creating account...");
    setBusy("signup");
    const res = await apiPost<AuthResponse>("/api/session/register", {
      role: "CONSUMER",
      email: emailValue,
      password,
      fullName: "Consumer User",
    });
    if (!res.ok || !res.data) {
      setBusy(null);
      setTone("error");
      return setStatus(friendlyError(res.error));
    }
    writeSession({ user: res.data.user });
    setTone("success");
    setBusy(null);
    router.push("/dashboard");
  }

  async function login() {
    const emailValue = email.trim().toLowerCase();
    if (!isValidEmail(emailValue)) {
      setTone("error");
      return setStatus("Enter a valid email address.");
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
    setTone("success");
    setBusy(null);
    router.push("/dashboard");
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Login / Signup</h2>
          <p className="text-gray-600 mt-1">Access your requests and book trusted providers.</p>
          <input className="mt-4 w-full px-4 py-3 border border-gray-300 rounded-lg" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="mt-4 flex gap-3">
            <button disabled={busy !== null} className="px-5 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold disabled:opacity-60" onClick={login}>
              {busy === "login" ? "Signing in..." : "Login"}
            </button>
            <button disabled={busy !== null} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-60" onClick={signup}>
              {busy === "signup" ? "Creating..." : "Create account"}
            </button>
          </div>
          <p className="mt-4 text-gray-600">{status}</p>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
