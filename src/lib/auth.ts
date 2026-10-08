import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

import { checkRateLimit } from "@/lib/rateLimit";

// 7 days session duration with daily rolling updates on active usage
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

if (!process.env.NEXTAUTH_URL && typeof window === "undefined") {
  if (process.env.NODE_ENV === "development") {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  } else if (process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
  } else {
    process.env.NEXTAUTH_URL = "https://system.lk-tronics.com";
  }
}

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev_temp_secret_key_needs_env_auth_secret_32_chars";

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = authSecret;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: SEVEN_DAYS_IN_SECONDS,
    updateAge: 24 * 60 * 60, // Refresh session token expiry daily on user activity
  },
  useSecureCookies: false, // Ensures consistent cookie naming across reverse proxies (Nginx/Cloudflare) and local dev
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Invalid username or password");
        }

        const username = credentials.username.trim().toLowerCase();

        // SEC-05 Remediation: Dual-layer rate limiting (IP-based and username-based)
        const forwarded =
          (req as any)?.headers?.["x-forwarded-for"] ||
          (req as any)?.headers?.["x-real-ip"];
        const clientIp =
          typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "127.0.0.1";

        const ipRateCheck = checkRateLimit(`login_ip:${clientIp}`, 30, 60 * 1000);
        if (!ipRateCheck.success) {
          throw new Error("Too many login attempts from this network. Please try again in a minute.");
        }

        const userRateCheck = checkRateLimit(`login_user:${username}`, 10, 60 * 1000);
        if (!userRateCheck.success) {
          throw new Error("Too many login attempts for this account. Please wait a minute before trying again.");
        }

        let user: any = null;
        try {
          user = await prisma.user.findUnique({
            where: { username },
          });
        } catch {
          const raw = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM User WHERE username = ? LIMIT 1`,
            username
          );
          user = raw[0] || null;
        }

        if (!user || user.status !== "ACTIVE") {
          throw new Error("Invalid credentials or account inactive");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValidPassword) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id.toString(),
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // SEC-03 Remediation: Validate account status on token checks to revoke deactivated sessions immediately
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        return token;
      }

      // Check DB to ensure user is still ACTIVE and reflect any role changes
      if (token?.id) {
        const userId = parseInt(token.id as string, 10);
        if (isNaN(userId)) return null as any;

        try {
          let dbUser: any = null;
          try {
            dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, username: true, role: true, status: true },
            });
          } catch {
            const raw = await prisma.$queryRawUnsafe<any[]>(
              `SELECT id, username, role, status FROM User WHERE id = ? LIMIT 1`,
              userId
            );
            dbUser = raw[0] || null;
          }

          // Invalidate session immediately if user deleted or deactivated
          if (!dbUser || dbUser.status !== "ACTIVE") {
            return null as any;
          }

          token.username = dbUser.username;
          token.role = dbUser.role;
        } catch (err) {
          console.error("Error verifying user session status:", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Always return relative path so remote network PCs stay on their IP/hostname rather than getting forced onto localhost
      if (url.startsWith("/")) return url;
      try {
        const parsed = new URL(url);
        return parsed.pathname + parsed.search;
      } catch {
        return "/dashboard";
      }
    },
  },
  secret: authSecret || "dev_temp_secret_key_needs_env_auth_secret_32_chars",
};
