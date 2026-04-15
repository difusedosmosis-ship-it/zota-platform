"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  tone?: "info" | "success" | "error";
};

export function StatusToast({ message, tone = "info" }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message || tone === "info") {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, tone === "success" ? 1000 : 1600);

    return () => window.clearTimeout(timeout);
  }, [message, tone]);

  if (!message || tone === "info" || !visible) return null;

  const palette =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ top: "calc(var(--safe-top) + 5rem)" }}>
      <div
        role="status"
        aria-live="polite"
        className={`max-w-sm rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur ${palette}`}
      >
        {message}
      </div>
    </div>
  );
}
