import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Role-based route protection for User management
    if (pathname.startsWith("/users") || pathname.startsWith("/api/users")) {
      // /api/users/list is permitted for any authenticated user (used for dropdowns)
      if (pathname === "/api/users/list") {
        return NextResponse.next();
      }

      const role = token?.role as string | undefined;
      if (role !== "ADMIN" && role !== "SUPERADMIN") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Forbidden: Administrator role required" },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/products/:path*",
    "/supply/:path*",
    "/users/:path*",
    "/api/products/:path*",
    "/api/categories/:path*",
    "/api/suppliers/:path*",
    "/api/supply/:path*",
    "/api/upload/:path*",
    "/api/users/:path*",
    "/api/settings/:path*",
    "/api/admin/:path*",
    "/api/stats/:path*",
  ],
};
