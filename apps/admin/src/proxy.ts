import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "bm_session";
const PROTECTED = ["/dashboard", "/kyc", "/catalog", "/finance", "/team", "/messages", "/notifications"];
const ROLE = "ADMIN";
const AREA_BY_PATH: Record<string, string> = {
  "/dashboard": "OVERVIEW",
  "/kyc": "KYC",
  "/catalog": "CATALOG",
  "/finance": "FINANCE",
  "/team": "TEAM",
  "/messages": "MESSAGES",
  "/notifications": "NOTIFICATIONS",
};

function decodePayload(raw?: string) {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json) as { user: { role: string; officePermissions?: string[]; isSuperAdmin?: boolean; isDisabled?: boolean } };
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  const session = decodePayload(raw);

  if (pathname === "/login" && session?.user?.role === ROLE) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    if (!session || session.user.role !== ROLE || session.user.isDisabled) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    const matched = Object.entries(AREA_BY_PATH).find(([key]) => pathname.startsWith(key));
    const requiredArea = matched?.[1];
    if (requiredArea && !session.user.isSuperAdmin && !(session.user.officePermissions ?? []).includes(requiredArea)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/kyc/:path*", "/catalog/:path*", "/finance/:path*", "/team/:path*", "/messages/:path*", "/notifications/:path*"],
};
