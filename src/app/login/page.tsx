"use client";

import { useState } from "react";
import ShopLogo from "@/components/ShopLogo";
import { useShop } from "@/lib/useShop";
import { shopHref } from "@/lib/shops";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const shop = useShop();
  const supabase = createClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const value = identifier.trim();
    let email = value;

    if (!value.includes("@")) {
      // กรอกมาเป็นเบอร์โทร — ค้นหาอีเมลที่ผูกไว้ก่อน
      const { data: resolvedEmail, error: lookupError } = await supabase.rpc(
        "get_email_by_phone",
        { p_phone: value }
      );
      if (lookupError || !resolvedEmail) {
        setError("ไม่พบบัญชีที่ใช้เบอร์โทรนี้");
        setLoading(false);
        return;
      }
      email = resolvedEmail;
    }

    const { data: signIn, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("อีเมล/เบอร์โทร หรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }
    // บัญชีใช้ระบบ auth ร่วมกันทุกร้าน ล็อกอินผ่านแล้วต้องเช็กว่าเป็นคนของร้านนี้จริง
    const { data: membership } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", signIn.user.id)
      .maybeSingle();
    if (!membership) {
      await supabase.auth.signOut({ scope: "local" });
      setError("บัญชีนี้ไม่ได้อยู่ในร้านนี้ กรุณาใช้บัญชีของร้านนี้");
      setLoading(false);
      return;
    }
    router.push(shopHref(shop, "/"));
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-neutral-900 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl shadow-sm">
            <ShopLogo size={64} priority />
          </div>
          <h1 className="text-2xl font-bold">
            {shop.basePath ? shop.label : "ระบบขายหน้าร้าน"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            เข้าสู่ระบบเพื่อเริ่มขาย
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              อีเมล หรือ เบอร์โทร
            </label>
            <input
              type="text"
              className="input"
              placeholder="you@example.com หรือ 0812345678"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              maxLength={100}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              รหัสผ่าน
            </label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              maxLength={72}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading} aria-busy={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-400">
          พนักงานใหม่ให้เจ้าของร้านสร้างบัญชีให้ที่เมนู “พนักงาน”
        </p>
      </div>
    </main>
  );
}
