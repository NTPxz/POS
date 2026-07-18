"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/ProfileProvider";
import { isPushSupported, subscribeToPush } from "@/lib/push";

const DISMISS_KEY = "pos-push-banner-dismissed";

export default function PushSetup() {
  const { profile } = useProfile();
  const [showBanner, setShowBanner] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !isPushSupported()) return;

    if (Notification.permission === "granted") {
      // มีการอนุญาตอยู่แล้ว sync subscription เงียบๆ เผื่อเบราว์เซอร์ล้าง endpoint เดิม
      void saveSubscription(profile.id);
      return;
    }
    if (Notification.permission === "denied") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setShowBanner(true);
  }, [profile]);

  async function saveSubscription(userId: string) {
    try {
      const sub = await subscribeToPush();
      if (!sub) return;
      const supabase = createClient();
      await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { onConflict: "endpoint" }
        );
    } catch {
      // sync เงียบๆ ไม่ต้องรบกวนผู้ใช้ถ้าล้มเหลว
    }
  }

  async function enable() {
    if (!profile) return;
    setEnabling(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("ไม่ได้รับอนุญาตให้แจ้งเตือน — เปิดได้ทีหลังในตั้งค่าเบราว์เซอร์");
        setEnabling(false);
        return;
      }
      await saveSubscription(profile.id);
      setShowBanner(false);
    } catch {
      setError("เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setEnabling(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-lg md:bottom-4 md:left-auto md:right-4 md:mx-0">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
        <BellRing className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-800">เปิดแจ้งเตือนแม้ปิดหน้าจอ</p>
        <p className="mt-0.5 text-sm text-neutral-600">
          รับแจ้งเตือนเมื่อลูกค้าสั่งอาหาร/เรียกเก็บเงิน แม้ล็อกจอหรือสลับแอปอยู่
        </p>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button
            className="btn-primary px-4 py-2 text-sm"
            onClick={enable}
            disabled={enabling}
          >
            {enabling ? "กำลังเปิด..." : "เปิดแจ้งเตือน"}
          </button>
          <button
            className="btn-secondary px-4 py-2 text-sm"
            onClick={dismiss}
            disabled={enabling}
          >
            ไว้ทีหลัง
          </button>
        </div>
      </div>
      <button
        className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-black/5"
        onClick={dismiss}
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
