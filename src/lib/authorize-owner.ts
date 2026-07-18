import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function requireOwner() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "ต้องล็อกอินก่อน", status: 401 };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "owner") {
    return {
      ok: false as const,
      error: "ต้องเป็นเจ้าของร้านเท่านั้น",
      status: 403,
    };
  }
  return { ok: true as const, userId: user.id };
}
