// สร้างบัญชีเจ้าของร้านร่มโพธิ์คนแรก (profile แรกใน schema rompho จะเป็น owner อัตโนมัติ)
// วิธีใช้: node --env-file=.env.local scripts/create_rompho_owner.mjs <เบอร์โทร> <รหัสผ่าน>
import { createClient } from "@supabase/supabase-js";

const [phone, password] = process.argv.slice(2);
const phoneDigits = (phone ?? "").replace(/\D/g, "");
if (!phoneDigits || (password ?? "").length < 6) {
  console.error("ต้องระบุเบอร์โทร และรหัสผ่านอย่างน้อย 6 ตัวอักษร");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "rompho" }, auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await admin.auth.admin.createUser({
  email: `phone-${phoneDigits}@rompho.staff.pos.local`,
  password,
  email_confirm: true,
  app_metadata: { shop: "rompho" },
});
if (error) {
  console.error(error.message);
  process.exit(1);
}

const { error: updateError } = await admin
  .from("profiles")
  .update({ phone: phoneDigits })
  .eq("id", data.user.id);
if (updateError) {
  console.error(updateError.message);
  process.exit(1);
}
console.log("สร้างบัญชีเจ้าของร้านร่มโพธิ์แล้ว");
