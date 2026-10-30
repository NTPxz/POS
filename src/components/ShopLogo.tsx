"use client";

import Image from "next/image";
import { useShop } from "@/lib/useShop";

export default function ShopLogo({
  size,
  priority,
}: {
  size: number;
  priority?: boolean;
}) {
  const shop = useShop();
  if (!shop.logo) {
    return (
      <div
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center bg-brand-700 text-xl font-bold text-white"
      >
        {shop.logoInitial}
      </div>
    );
  }
  return (
    <Image
      src={shop.logo}
      alt="โลโก้ร้าน"
      width={size}
      height={size}
      className="h-full w-full object-cover"
      priority={priority}
    />
  );
}
