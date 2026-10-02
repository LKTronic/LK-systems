"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  requireAdmin?: boolean;
}

export function AppLayout({
  children,
  title,
  description,
  requireAdmin = false,
}: AppLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const role = (session?.user as any)?.role || "STAFF";
  const isShop = role === "SHOP";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if (requireAdmin && role !== "ADMIN" && role !== "SUPERADMIN") {
        router.push(isShop ? "/products" : "/dashboard");
      }
    }
  }, [isMounted, status, session, router, requireAdmin, role, isShop]);

  // Safety timer: prevent getting permanently stuck on loading screen
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "loading") {
        router.push("/login");
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [status, router]);

  if (!isMounted || status === "loading") {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400"
      >
        <div suppressHydrationWarning className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Verifying authorization...</p>
          <a
            href="/login"
            className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-2"
          >
            Click here if not redirected
          </a>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div suppressHydrationWarning className="flex min-h-screen bg-slate-950 text-slate-100">
      {!isShop && <Sidebar />}
      <div suppressHydrationWarning className="flex-1 flex flex-col min-w-0 w-full">
        <Header title={title} description={description} />
        <main suppressHydrationWarning className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
