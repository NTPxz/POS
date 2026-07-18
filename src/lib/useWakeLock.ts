"use client";

import { useEffect, useRef } from "react";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/** กันจอดับ/ล็อกอัตโนมัติระหว่างเปิดหน้าเว็บไว้ค้าง จะได้ไม่พลาดเสียงแจ้งเตือนออเดอร์ */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let cancelled = false;

    async function requestLock() {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
      } catch {
        // อุปกรณ์/เบราว์เซอร์ไม่รองรับ หรือถูกปฏิเสธ (เช่น battery saver) — ปล่อยผ่าน
      }
    }

    requestLock();

    function handleVisibility() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        requestLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
