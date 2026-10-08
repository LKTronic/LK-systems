"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, User, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { persistAuthSession } from "@/lib/offlineAuth";

function getSafeRedirectTarget(rawCallbackUrl: string | null | undefined, role?: string): string {
  const fallback = role === "SHOP" ? "/products" : "/dashboard";
  if (!rawCallbackUrl) return fallback;

  try {
    // If it's an absolute URL (e.g. http://localhost:3000/dashboard or http://192.168.1.10:3000/dashboard)
    if (rawCallbackUrl.startsWith("http://") || rawCallbackUrl.startsWith("https://")) {
      const parsed = new URL(rawCallbackUrl);
      const path = parsed.pathname + parsed.search;
      if (!path || path === "/" || path.includes("/login")) {
        return fallback;
      }
      if (role === "SHOP" && (path.startsWith("/dashboard") || path.startsWith("/supply") || path.startsWith("/users"))) {
        return "/products";
      }
      return path;
    }
  } catch (e) {}

  // If it's a relative path
  if (rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//") && !rawCallbackUrl.includes("/login")) {
    if (rawCallbackUrl === "/") return fallback;
    if (role === "SHOP" && (rawCallbackUrl.startsWith("/dashboard") || rawCallbackUrl.startsWith("/supply") || rawCallbackUrl.startsWith("/users"))) {
      return "/products";
    }
    return rawCallbackUrl;
  }

  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && !redirecting) {
      if (session?.user) {
        persistAuthSession(session);
      }
      const role = (session?.user as any)?.role;
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const target = getSafeRedirectTarget(params?.get("callbackUrl"), role);
      setRedirecting(true);
      window.location.href = target;
      setTimeout(() => {
        window.location.assign(target);
      }, 2000);
    }
  }, [status, session, redirecting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (res?.error) {
        setError(res.error || "Invalid username or password");
        setIsLoading(false);
      } else {
        setRedirecting(true);
        let role: string | undefined;
        try {
          const sessionRes = await fetch("/api/auth/session");
          if (sessionRes.ok) {
            const sess = await sessionRes.json();
            if (sess?.user) {
              persistAuthSession(sess);
              role = (sess.user as any)?.role;
            }
          }
        } catch (e) {}

        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const target = getSafeRedirectTarget(params?.get("callbackUrl"), role);
        window.location.href = target;
        setTimeout(() => {
          window.location.assign(target);
        }, 2000);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // Only show full-screen loader if user is already authenticated and redirecting
  if (redirecting) {
    const role = (session?.user as any)?.role;
    const dest = role === "SHOP" ? "/products" : "/dashboard";
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs text-slate-400">Redirecting to your workspace...</p>
          <a
            href={dest}
            onClick={(e) => {
              e.preventDefault();
              window.location.href = dest;
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-2 cursor-pointer"
          >
            Click here if not redirected automatically
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12"
    >
      <div
        suppressHydrationWarning
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-indigo-950/50"
      >
        <div
          suppressHydrationWarning
          className="flex flex-col items-center text-center mb-8"
        >
          <div
            suppressHydrationWarning
            className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/30 mb-4"
          >
            P
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Product Management System
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sign in to access your enterprise dashboard
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div suppressHydrationWarning>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Username
            </label>
            <div suppressHydrationWarning className="relative">
              <div
                suppressHydrationWarning
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500"
              >
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
              />
            </div>
          </div>

          <div suppressHydrationWarning>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div suppressHydrationWarning className="relative">
              <div
                suppressHydrationWarning
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500"
              >
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In to PMS"
            )}
          </button>
        </form>

        <div
          suppressHydrationWarning
          className="mt-8 pt-6 border-t border-slate-800 text-center"
        >
          <p className="text-xs text-slate-500">
            Internal Company System • Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
}
