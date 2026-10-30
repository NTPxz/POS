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
  if (!userId) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 400 });
  }
  // ผู้เรียกเป็น owner และลบตัวเองไม่ได้ ร้านจึงเหลือ owner อย่างน้อย 1 คนเสมอ
  if (userId === auth.userId) {
    return NextResponse.json({ error: "ลบบัญชีของตัวเองไม่ได้" }, { status: 400 });
  }

  const admin = createAdminClient(shop);
  // บัญชีใช้ระบบ auth ร่วมกันทุกร้าน ต้องไม่ให้เจ้าของร้านหนึ่งลบคนของอีกร้าน
  const { data: target } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 400 });
  }

  const { data: authUser, error: getError } =
    await admin.auth.admin.getUserById(userId);
  if (getError || !authUser.user) {
    return NextResponse.json(
      { error: getError?.message ?? "ไม่พบผู้ใช้" },
      { status: 400 }
    );
  }

  const shops: string[] = authUser.user.app_metadata?.shops ?? [];
  const otherShops = shops.filter((s) => s !== shop.dbSchema);

  // บัญชีที่ยังเข้าร้านอื่นได้: ถอดออกจากร้านนี้ร้านเดียว ห้ามแตะบัญชีจริง
  if (otherShops.length > 0) {
    const removeError = await removeFromShop(admin, userId);
    if (removeError) {
      return NextResponse.json({ error: removeError }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { shops: otherShops },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (!deleteError) {
    return NextResponse.json({ ok: true });
  }

  // ลบไม่ผ่านเมื่อบัญชีมีประวัติอ้างอิงอยู่ (ยอดขาย, log ฯลฯ) ต้องเก็บประวัติไว้
  // จึงปิดบัญชีแทน และเปลี่ยนอีเมลเพื่อให้เบอร์นี้เอาไปสร้างบัญชีใหม่ได้
  const removeError = await removeFromShop(admin, userId);
  if (removeError) {
    return NextResponse.json({ error: removeError }, { status: 400 });
  }
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
    email: `deleted-${userId}@staff.pos.local`,
    email_confirm: true,
  });
  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

async function removeFromShop(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string | null> {
  const { error: pushError } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);
  if (pushError) return pushError.message;

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);
  return profileError?.message ?? null;
}
