"use client";

import { useState } from "react";
import ShopLogo from "@/components/ShopLogo";
import { useShop } from "@/lib/useShop";
import { shopHref } from "@/lib/shops";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const shop = useShop();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณากรอกใหม่ให้เหมือนกัน");
      return;
    }
    setSaving(true);

    const res = await fetch(`${shop.basePath}/api/account/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง");
      setSaving(false);
      return;
    }

    // ล็อกอินใหม่ด้วยรหัสใหม่ เผื่อการเปลี่ยนรหัสทำให้ session เดิมหลุด
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.signInWithPassword({ email: user.email, password });
    }
    // โหลดหน้าใหม่ทั้งหน้าเพื่อให้ middleware อ่านสถานะล่าสุด
    window.location.assign(shopHref(shop, "/"));
  }

  async function handleLogout() {
    await createClient().auth.signOut();
    window.location.assign(shopHref(shop, "/login"));
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-neutral-900 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl shadow-sm">
            <ShopLogo size={64} priority />
          </div>
          <h1 className="text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
          <p className="mt-1 text-sm text-neutral-500">
            ตั้งรหัสของคุณเองก่อนเริ่มใช้งาน เจ้าของร้านจะไม่รู้รหัสนี้
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              รหัสผ่านใหม่
            </label>
            <input
              id="new-password"
              type="password"
              className="input"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              maxLength={72}
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              ยืนยันรหัสผ่านใหม่
            </label>
            <input
              id="confirm-password"
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              maxLength={72}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกรหัสผ่าน"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 w-full rounded-xl py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
        >
          ออกจากระบบ
        </button>
      </div>
    </main>
  );
}
