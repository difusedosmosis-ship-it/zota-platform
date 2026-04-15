"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "zota-business-tour-dismissed";

type Step = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

const STEPS: Step[] = [
  {
    title: "Set up your business profile",
    body: "Add your business name, city, coverage radius, and operating status so your account reads like a real business, not an empty shell.",
    href: "/account",
    cta: "Open account",
  },
  {
    title: "Complete verification",
    body: "Submit NIN or ID, business proof, and skill proof so Zota Office can approve the business for trust and customer visibility.",
    href: "/kyc",
    cta: "Open verification",
  },
  {
    title: "Publish services and assets",
    body: "Create clean service entries and bookable assets so the consumer app can discover and surface your business properly.",
    href: "/services",
    cta: "Open services",
  },
  {
    title: "Respond to requests",
    body: "Watch the requests queue, open customer messages, and move jobs from offer to delivery and payout.",
    href: "/requests",
    cta: "Open requests",
  },
];

export function OnboardingTour() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const forceOpen = searchParams.get("tour") === "1";
    const dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
    if (forceOpen || !dismissed) {
      setOpen(true);
      if (forceOpen) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [searchParams]);

  const step = useMemo(() => STEPS[stepIndex], [stepIndex]);
  const isLast = stepIndex === STEPS.length - 1;

  function closeTour() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/30 p-4 md:items-center">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Business setup tour</p>
          <button className="text-sm font-semibold text-slate-500" onClick={closeTour}>
            Skip
          </button>
        </div>

        <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{step.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{step.body}</p>

        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-2.5 rounded-full transition-all ${index === stepIndex ? "w-8 bg-slate-950" : "w-2.5 bg-slate-200"}`}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={step.href} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white" onClick={closeTour}>
            {step.cta}
          </Link>
          {!isLast ? (
            <button
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
              onClick={() => setStepIndex((current) => Math.min(current + 1, STEPS.length - 1))}
            >
              Next
            </button>
          ) : (
            <button className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700" onClick={closeTour}>
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
