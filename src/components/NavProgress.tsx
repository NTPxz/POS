"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// กันแถบค้างถ้าการเปลี่ยนหน้าล้มเหลวโดยไม่มี pathname ใหม่
const MAX_VISIBLE_MS = 10000;

/** แถบบางด้านบนจอ ตอบสนองทันทีที่กดเมนู ระหว่างรอหน้าใหม่จากเซิร์ฟเวอร์ */
export default function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      if (link.origin !== window.location.origin) return;
      if (link.pathname !== window.location.pathname) setActive(true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(false), MAX_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;
  return <div aria-hidden="true" className="nav-progress" />;
}
