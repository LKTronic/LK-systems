import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

import { checkRateLimit } from "@/lib/rateLimit";

// 7 days session duration with daily rolling updates on active usage
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

// SEC-02 Remediation: Validate that AUTH_SECRET is provided via environment
const authSecret = process.env.AUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: AUTH_SECRET environment variable is missing in production.");
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: SEVEN_DAYS_IN_SECONDS,
    updateAge: 24 * 60 * 60, // Refresh session token expiry daily on user activity
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: SEVEN_DAYS_IN_SECONDS,
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

        const user = await prisma.user.findUnique({
          where: { username },
        });

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
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, role: true, status: true },
          });

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
  },
  secret: authSecret || "dev_temp_secret_key_needs_env_auth_secret_32_chars",
};
