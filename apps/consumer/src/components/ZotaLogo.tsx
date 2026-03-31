"use client";

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
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        aria-label="Zota logo"
        role="img"
        className="shrink-0"
      >
        <rect width="120" height="120" rx="30" fill="#171b24" />
        <path
          d="M24 78c5-8 14-17 30-31 14-12 21-19 21-23 0-3-4-4-11-4-12 0-25 2-38 7l7-14c9-4 22-6 40-6 19 0 29 4 29 12 0 6-7 15-22 29L58 67l35-7c7-1 13-2 18-2 10 0 16 3 18 9l5 14c-7-3-13-4-20-4-5 0-11 1-19 3L36 98c-6 2-12 3-17 3-10 0-15-3-15-8 0-3 2-7 6-15Z"
          fill="#F8F8F7"
        />
        <path
          d="M86 14h18l-38 39H47L86 14Zm15 3c5 0 9 2 11 7l13 34h-16L95 34 74 55H56l35-38Z"
          fill="#F8F8F7"
        />
      </svg>
      {showWordmark && (
        <span className={`font-black tracking-tight text-slate-900 ${compact ? "text-xl sm:text-2xl" : "text-2xl"}`}>
          Zota
        </span>
      )}
    </div>
  );
}
