"use client";

import { usePathname } from "next/navigation";
import { shopFromPathname } from "@/lib/shops";

export function useShop() {
  return shopFromPathname(usePathname());
}
