"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/ProfileProvider";
import { hasRole, Role, ROLE_LABELS } from "@/lib/types";
import OrderNotifications from "@/components/OrderNotifications";
import PushSetup from "@/components/PushSetup";
import { useWakeLock } from "@/lib/useWakeLock";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof ShoppingCart;
  minRole: Role;
}[] = [
  { href: "/", label: "ขายสินค้า", icon: ShoppingCart, minRole: "staff" },
  { href: "/sales", label: "ประวัติขาย", icon: Receipt, minRole: "staff" },
  { href: "/products", label: "สินค้า", icon: Package, minRole: "staff" },
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard, minRole: "owner" },
  { href: "/income", label: "รายได้", icon: TrendingUp, minRole: "owner" },
  { href: "/expenses", label: "รายจ่าย", icon: Wallet, minRole: "owner" },
  { href: "/staff", label: "พนักงาน", icon: Users, minRole: "owner" },
  { href: "/log", label: "Log", icon: History, minRole: "owner" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const role = profile?.role ?? "staff";
  const visibleItems = NAV_ITEMS.filter((item) => hasRole(role, item.minRole));

  useWakeLock(!!profile);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <OrderNotifications />
      <PushSetup />
      {/* Sidebar สำหรับจอใหญ่ (iPad แนวนอน / PC) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-neutral-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
            <Image
              src="/logo.png"
              alt="โลโก้ร้าน"
              width={40}
              height={40}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div>
            <p className="font-bold leading-tight">POS</p>
            <p className="text-xs text-neutral-500">
              {profile ? ROLE_LABELS[profile.role] : "ระบบขายหน้าร้าน"}
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-neutral-600 hover:bg-neutral-50"
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
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" strokeWidth={2} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* คอลัมน์เนื้อหา: ครอบความสูงไว้แค่ h-dvh แล้วให้เนื้อหาสกอลล์ในตัวเอง
         แถบเมนูล่างเลยเป็น flex item ปกติท้ายคอลัมน์ ไม่ต้องใช้ position: fixed
         (เบราว์เซอร์มือถือบางตัวโดยเฉพาะ iOS Safari เรนเดอร์ fixed element
         เลื่อนตามเนื้อหาระหว่างสกอลล์ก่อน snap กลับที่เดิม — ไม่ fixed แต่ยึด
         layout ด้วย flexbox ความสูงคงที่แทน ตัดปัญหานี้ไปเลย) */}
      <div className="flex h-dvh min-w-0 flex-1 flex-col md:ml-56">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </div>

        {/* Bottom nav สำหรับมือถือ */}
        <nav className="flex shrink-0 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                  active ? "text-brand-600" : "text-neutral-500"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-neutral-500"
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
            <span className="w-full truncate text-center">ออก</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
