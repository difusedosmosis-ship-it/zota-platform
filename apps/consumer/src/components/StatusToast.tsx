"use client";

type Props = {
  message: string;
  tone?: "info" | "success" | "error";
};

export function StatusToast({ message, tone = "info" }: Props) {
  return <div className={`bm-toast bm-toast-${tone}`}>{message}</div>;
}
