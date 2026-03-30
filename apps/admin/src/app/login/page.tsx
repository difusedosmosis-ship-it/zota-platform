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

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Passw0rd!");
  const [status, setStatus] = useState("Use admin email/password.");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  async function signup() {
    const emailValue = email.trim().toLowerCase();
    if (!isValidEmail(emailValue)) {
      setTone("error");
      setStatus("Enter a valid email address.");
      return;
    }

    setTone("info");
    setStatus("Creating admin account...");
    const res = await apiPost<AuthResponse>("/api/session/register", {
      role: "ADMIN",
      email: emailValue,
      password,
      fullName: "Admin User",
    });
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(friendlyError(res.error));
    }
    setTone("success");
    writeSession({ user: res.data.user });
    router.push("/dashboard");
  }

  async function login() {
    const emailValue = email.trim().toLowerCase();
    if (!isValidEmail(emailValue)) {
      setTone("error");
      setStatus("Enter a valid email address.");
      return;
    }

    setTone("info");
    setStatus("Signing in...");
    const res = await apiPost<AuthResponse>("/api/session/login", { email: emailValue, password });
    if (!res.ok || !res.data) {
      setTone("error");
      return setStatus(friendlyError(res.error));
    }
    setTone("success");
    writeSession({ user: res.data.user });
    router.push("/dashboard");
  }

  return (
    <AppShell>
      <section className="bm-card bm-rise-2" style={{ maxWidth: 560, margin: "12px auto 0" }}>
        <h2>Admin Login / Signup</h2>
        <input className="bm-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="bm-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="bm-row">
          <button className="bm-btn bm-btn-primary" onClick={signup}>Create admin account</button>
          <button className="bm-btn" onClick={login}>Login</button>
        </div>
        <p className="bm-status">{status}</p>
      </section>
      <StatusToast message={status} tone={tone} />
    </AppShell>
  );
}
