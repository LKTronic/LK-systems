"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Users,
  LogOut,
  Truck,
  ShieldAlert,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "STAFF";
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  const isShop = role === "SHOP";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Product", href: "/products", icon: Package },
    ...(!isShop
      ? [
          { name: "Download Pending Requests", href: "/products/pending-download", icon: Download },
          { name: "Supply", href: "/supply", icon: Truck },
        ]
      : []),
  ];

  const adminNavigation = [
    { name: "User Management", href: "/users", icon: Users },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/30">
          P
        </div>
        <div>
          <h1 className="font-bold text-base text-white tracking-wide">
            PMS Enterprise
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">
            Product Management
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-4 space-y-6 overflow-y-auto">
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Main Operations
          </div>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive =
                item.href === "/products"
                  ? pathname === "/products" ||
                    (pathname.startsWith("/products/") &&
                      !pathname.startsWith("/products/pending-download"))
                  : pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {isAdmin && (
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-amber-400/90 uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Administration
            </div>
            <nav className="space-y-1">
              {adminNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={true}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/80">
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-medium text-white truncate">
              {session?.user?.name || "Authenticated User"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  role === "SUPERADMIN"
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    : role === "ADMIN"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : role === "SHOP"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                }`}
              >
                {role}
              </span>
              <span className="text-xs text-slate-400 truncate">
                @{(session?.user as any)?.username || "user"}
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 border border-rose-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
