"use client";

import { useSession } from "next-auth/react";
import { Bell, ShieldCheck, User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header({ title, description }: { title: string; description?: string }) {
  const { data: session } = useSession();

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-8 flex items-center justify-between sticky top-0 z-10 transition-colors">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>System Active</span>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-200">
              {session?.user?.name || "User"}
            </div>
            <div className="text-[10px] text-slate-400">
              @{(session?.user as any)?.username || "staff"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
