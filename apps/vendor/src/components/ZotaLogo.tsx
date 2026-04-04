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
        src="/zota-business-icon.png"
        alt="Zota Business logo"
        width={size}
        height={size}
        className="shrink-0 rounded-[18px]"
        priority
      />
      {showWordmark && (
        <span className={`font-black tracking-tight text-slate-900 ${compact ? "text-xl sm:text-2xl" : "text-2xl"}`}>
          Zota Business
        </span>
      )}
    </div>
  );
}
