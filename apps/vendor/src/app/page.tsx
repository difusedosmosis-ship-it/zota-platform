"use client";

import Link from "next/link";
import { AppShell } from "@/components/Shell";

export default function VendorLandingPage() {
  return (
    <AppShell>
      <section className="w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grow Your Service Business with Zota</h1>
          <p className="text-lg md:text-xl opacity-90 max-w-3xl">
            Join verified professionals, receive high-quality requests, and manage operations from one dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="px-6 py-3 bg-white text-indigo-600 hover:bg-gray-50 font-bold rounded-xl transition-all" href="/login">
              Create Vendor Account
            </Link>
            <Link className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 border border-white/30 text-white font-bold rounded-xl transition-all" href="/dashboard">
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          <article className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">1. Onboard</h3>
            <p className="mt-2 text-gray-600">Set up your profile, service areas, and business details.</p>
          </article>
          <article className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">2. Verify KYC</h3>
            <p className="mt-2 text-gray-600">Submit required documents and get approved by admin.</p>
          </article>
          <article className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">3. Publish Services</h3>
            <p className="mt-2 text-gray-600">List service offerings and start receiving customer leads.</p>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
