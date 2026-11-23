import { NextRequest, NextResponse } from "next/server";

// Convenience only: send signed-out page requests to /login before the page loads.
// The backend checks the session on every API call.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("ndap_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/map/:path*", "/graph/:path*", "/timeline/:path*", "/admin/:path*", "/change-password"],
};
