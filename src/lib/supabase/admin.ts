import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * ใช้ service role key ซึ่งข้าม RLS ทั้งหมด — เรียกได้เฉพาะจาก
 * Route Handler ฝั่งเซิร์ฟเวอร์เท่านั้น ห้าม import จาก client component เด็ดขาด
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "ไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY — ดูวิธีตั้งค่าใน README"
    );
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
