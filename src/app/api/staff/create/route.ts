import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/authorize-owner";
import { Role } from "@/lib/types";

const ALLOWED_ROLES: Role[] = ["owner", "manager", "staff"];

export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const fullName: string = (body?.fullName ?? "").trim();
  const emailInput: string = (body?.email ?? "").trim().toLowerCase();
  const password: string = body?.password ?? "";
  const role: Role = body?.role;
  const phoneDigits: string = (body?.phone ?? "").replace(/\D/g, "");

  if (!phoneDigits) {
    return NextResponse.json({ error: "กรุณากรอกเบอร์โทร" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
      { status: 400 }
    );
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: existingPhone } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", phoneDigits)
    .maybeSingle();
  if (existingPhone) {
    return NextResponse.json(
      { error: "มีพนักงานที่ใช้เบอร์โทรนี้อยู่แล้ว" },
      { status: 409 }
    );
  }

  const email = emailInput || `phone-${phoneDigits}@staff.pos.local`;

  const admin = createAdminClient();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "สร้างบัญชีไม่สำเร็จ" },
      { status: 400 }
    );
  }

  // handle_new_user() trigger สร้างแถว profiles ให้อัตโนมัติแล้ว (role เริ่มต้น staff)
  // อัปเดตข้อมูลที่เหลือทับ
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      full_name: fullName || null,
      phone: phoneDigits,
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", created.user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id, email });
}
