"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "ขายสินค้า", icon: ShoppingCart },
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/sales", label: "ประวัติขาย", icon: Receipt },
  { href: "/products", label: "สินค้า", icon: Package },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar สำหรับจอใหญ่ (iPad แนวนอน / PC) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ShoppingCart className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="font-bold leading-tight">POS</p>
            <p className="text-xs text-slate-500">ระบบขายหน้าร้าน</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" strokeWidth={2} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* เนื้อหา */}
      <div className="flex min-h-dvh flex-1 flex-col pb-20 md:ml-56 md:pb-0">
        {children}
      </div>

      {/* Bottom nav สำหรับมือถือ */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                active ? "text-blue-600" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-slate-500"
        >
          <LogOut className="h-5 w-5" strokeWidth={2} />
          ออก
        </button>
      </nav>
    </div>
  );
}
