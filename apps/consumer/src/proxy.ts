import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "bm_session";
const PROTECTED = ["/dashboard", "/vendors", "/messages", "/requests", "/wallet", "/profile", "/assistant"];
const ROLE = "CONSUMER";

function decodePayload(raw?: string) {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json) as { user: { role: string } };
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
    if (!session || session.user.role !== ROLE) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/vendors/:path*", "/messages/:path*", "/requests/:path*", "/wallet/:path*", "/profile/:path*", "/assistant/:path*"],
};
