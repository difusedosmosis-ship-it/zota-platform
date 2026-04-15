"use client";

import Image from "next/image";

export function ZotaLogo({
  size = 40,
  showWordmark = true,
  compact = false,
}: {
  size?: number;
  showWordmark?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
      <Image
        src="/zota-office-logo.png"
        alt="Zota logo"
        width={size}
        height={size}
        className="shrink-0 rounded-[18px] bg-[#171b24] object-cover"
        priority
      />
      {showWordmark ? (
        <span className={`tracking-tight text-slate-950 ${compact ? "text-xl font-semibold sm:text-2xl" : "text-2xl font-semibold"}`}>
          Zota Office
        </span>
      ) : null}
    </div>
  );
}
