import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Reject unauthenticated API requests with 401 JSON instead of redirecting to HTML login page
    if (pathname.startsWith("/api/") && !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Role-based route protection for SHOP role:
    // SHOP users only use the Product Repository to search and request price.
    // Restrict access to /dashboard, /supply, /products/pending-download, /products/:id/edit, and import/supply APIs.
    const userRole = token?.role as string | undefined;
    if (userRole === "SHOP") {
      if (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/supply") ||
        pathname.startsWith("/api/supply") ||
        pathname.startsWith("/products/pending-download") ||
        pathname.startsWith("/api/products/export/pending") ||
        pathname.endsWith("/edit")
      ) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Forbidden: Not accessible for SHOP role" },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/products", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Let API routes pass through to middleware handler to return 401 JSON
        if (req.nextUrl.pathname.startsWith("/api/")) {
          return true;
        }
        return Boolean(token);
      },
    },
    pages: {
      signIn: "/login",
    },
    secret:
      process.env.NEXTAUTH_SECRET ||
      process.env.AUTH_SECRET ||
      "dev_temp_secret_key_needs_env_auth_secret_32_chars",
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
