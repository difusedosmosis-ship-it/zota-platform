"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Shell";
import { requireRole } from "@/lib/route-guard";

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    void requireRole(router, "CONSUMER");
  }, [router]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1">Manage your account, preferred locations and app settings.</p>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-gray-700">Profile and account settings will show here.</div>
      </div>
    </AppShell>
  );
}
