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
const DEFAULT_ADMIN_ROUTE = "/dashboard";

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

function firstAllowedRoute(user?: { officePermissions?: string[]; isSuperAdmin?: boolean }) {
  if (!user) return "/login";
  if (user.isSuperAdmin) return DEFAULT_ADMIN_ROUTE;

  const permissions = user.officePermissions ?? [];
  if (permissions.length === 0) return DEFAULT_ADMIN_ROUTE;

  const routes = Object.entries(AREA_BY_PATH);
  for (const [route, area] of routes) {
    if (permissions.includes(area)) return route;
  }

  return DEFAULT_ADMIN_ROUTE;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  const session = decodePayload(raw);
  const homeRoute = firstAllowedRoute(session?.user);

  if (pathname === "/login" && session?.user?.role === ROLE) {
    return NextResponse.redirect(new URL(homeRoute, req.url));
  }

  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    if (!session || session.user.role !== ROLE || session.user.isDisabled) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    const matched = Object.entries(AREA_BY_PATH).find(([key]) => pathname.startsWith(key));
    const requiredArea = matched?.[1];
    const permissions = session.user.officePermissions ?? [];
    const hasExplicitPermissions = permissions.length > 0;
    if (requiredArea && hasExplicitPermissions && !session.user.isSuperAdmin && !permissions.includes(requiredArea)) {
      return NextResponse.redirect(new URL(homeRoute, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/kyc/:path*", "/catalog/:path*", "/finance/:path*", "/team/:path*", "/messages/:path*", "/notifications/:path*"],
};
