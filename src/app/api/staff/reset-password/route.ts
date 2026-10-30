import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/authorize-owner";
import { shopFromPathname } from "@/lib/shops";

export async function POST(request: Request) {
  // route นี้ถูก re-export ไว้ใต้ /rompho/api ด้วย จึงดูร้านจาก path ที่ถูกเรียก
  const shop = shopFromPathname(new URL(request.url).pathname);
  const auth = await requireOwner(shop);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const userId: string = body?.userId ?? "";
  const password: string = body?.password ?? "";

  if (!userId) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
      { status: 400 }
    );
  }

  const admin = createAdminClient(shop);
  // บัญชีใช้ระบบ auth ร่วมกันทุกร้าน ต้องไม่ให้เจ้าของร้านหนึ่งรีเซ็ตรหัสของคนอีกร้าน
  const { data: target } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
