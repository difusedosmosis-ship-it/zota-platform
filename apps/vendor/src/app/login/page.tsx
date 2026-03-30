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

export default function VendorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Passw0rd!");
  const [status, setStatus] = useState("Use your vendor email/password.");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  async function signup() {
    const emailValue = email.trim().toLowerCase();
    if (!isValidEmail(emailValue)) {
      setTone("error");
      return setStatus("Enter a valid email address.");
    }

    setTone("info");
    setStatus("Creating vendor account...");
    const res = await apiPost<AuthResponse>("/api/session/register", {
      role: "VENDOR",
      email: emailValue,
      password,
      fullName: "Vendor User",
    });
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(friendlyError(res.error));
    }
    writeSession({ user: res.data.user });
    setTone("success");
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
    const res = await apiPost<AuthResponse>("/api/session/login", { email: emailValue, password });
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(friendlyError(res.error));
    }
    writeSession({ user: res.data.user });
    setTone("success");
    router.push("/dashboard");
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Vendor Login / Signup</h2>
          <p className="text-gray-600 mt-1">Access your dashboard and manage service operations.</p>
          <input className="mt-4 w-full px-4 py-3 border border-gray-300 rounded-lg" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="mt-4 flex gap-3">
            <button className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold" onClick={signup}>Create vendor account</button>
            <button className="px-5 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold" onClick={login}>Login</button>
          </div>
          <p className="mt-4 text-gray-600">{status}</p>
        </div>
      </div>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
