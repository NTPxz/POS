import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_MAX_AGE } from "@/lib/supabase/cookie-options";
import type { Shop } from "@/lib/shops";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient(shop: Shop): SupabaseClient {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: shop.dbSchema },
      cookieOptions: { maxAge: AUTH_COOKIE_MAX_AGE, name: shop.authCookieName },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // เรียกจาก Server Component ซึ่ง set cookie ไม่ได้ — middleware จัดการ refresh ให้แล้ว
          }
        },
      },
    }
  ) as unknown as SupabaseClient;
}
