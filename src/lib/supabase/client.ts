import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_COOKIE_MAX_AGE } from "@/lib/supabase/cookie-options";
import { currentShop, type ShopSlug } from "@/lib/shops";

// singleton ของ @supabase/ssr ไม่สนใจว่า schema เปลี่ยน จึงต้อง cache แยกเองรายร้าน
const clients = new Map<ShopSlug, SupabaseClient>();

export function createClient(): SupabaseClient {
  const shop = currentShop();
  const cached = clients.get(shop.slug);
  if (cached) return cached;

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: shop.dbSchema },
      cookieOptions: { maxAge: AUTH_COOKIE_MAX_AGE, name: shop.authCookieName },
      isSingleton: false,
    }
  ) as unknown as SupabaseClient;
  if (typeof window !== "undefined") clients.set(shop.slug, client);
  return client;
}
