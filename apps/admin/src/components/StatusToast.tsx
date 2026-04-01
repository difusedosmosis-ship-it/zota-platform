"use client";

type Props = {
  message: string;
  tone?: "info" | "success" | "error";
};

export function StatusToast({ message, tone = "info" }: Props) {
  if (!message || tone === "info") return null;

  const palette =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[70] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={`max-w-md rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur ${palette}`}
      >
        {message}
      </div>
    </div>
  );
}
