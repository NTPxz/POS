import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { shopFromPathname } from "@/lib/shops";

export async function POST(request: Request) {
  // route นี้ถูก re-export ไว้ใต้ /rompho/api ด้วย จึงดูร้านจาก path ที่ถูกเรียก
  const shop = shopFromPathname(new URL(request.url).pathname);
  const {
    data: { user },
  } = await createClient(shop).auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "ต้องล็อกอินก่อน" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const password: string = body?.password ?? "";
  if (password.length < 6) {
    return NextResponse.json(
      { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
      { status: 400 }
    );
  }

  // ลองล็อกอินด้วยรหัสใหม่ ถ้าผ่านแปลว่ายังเป็นรหัสเดิมที่เจ้าของร้านตั้งให้
  const probe = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error: sameError } = await probe.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (!sameError) {
    return NextResponse.json(
      { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม กรุณาตั้งรหัสอื่น" },
      { status: 400 }
    );
  }

  // ใช้ service role เพราะ app_metadata ผู้ใช้แก้เองไม่ได้ จึงปลดธงนี้เองโดยไม่เปลี่ยนรหัสไม่ได้
  const { error } = await createAdminClient(shop).auth.admin.updateUserById(
    user.id,
    { password, app_metadata: { must_change_password: false } }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
