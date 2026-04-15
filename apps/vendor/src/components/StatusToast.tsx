"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  tone?: "info" | "success" | "error";
};

export function StatusToast({ message, tone = "info" }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message || tone !== "error") {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [message, tone]);

  if (!message || tone !== "error" || !visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ bottom: "calc(var(--safe-bottom) + 5.5rem)" }}>
      <div
        role="status"
        aria-live="polite"
        className="max-w-sm rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur"
      >
        {message}
      </div>
    </div>
  );
}
