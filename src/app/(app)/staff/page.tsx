"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Info, Phone, RefreshCw, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { Profile, Role, ROLE_LABELS } from "@/lib/types";
import RequireRole from "@/components/RequireRole";
import { useProfile } from "@/components/ProfileProvider";

export default function StaffPage() {
  return (
    <RequireRole min="owner">
      <StaffPageContent />
    </RequireRole>
  );
}

const ROLE_ORDER: Role[] = ["owner", "manager", "staff"];

function StaffPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const { profile: me, refresh: refreshMe } = useProfile();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at");
      if (error) throw error;
      setStaff((data as Profile[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ownerCount = staff.filter((s) => s.role === "owner").length;

  async function changeRole(p: Profile, role: Role) {
    if (p.role === "owner" && role !== "owner" && ownerCount <= 1) {
      window.alert(
        "ลดสิทธิ์ไม่ได้ — นี่คือเจ้าของร้านคนสุดท้าย ต้องมีอย่างน้อย 1 คนเสมอ"
      );
      return;
    }
    if (
      p.id === me?.id &&
      role !== "owner" &&
      !window.confirm(
        "นี่คือบัญชีของคุณเอง หากลดสิทธิ์ตัวเองจะเข้าหน้านี้ไม่ได้อีก ยืนยันหรือไม่?"
      )
    ) {
      return;
    }
    setSavingId(p.id);
    const { error } = await supabase
      .from("profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setSavingId(null);
    if (error) {
      window.alert(`เปลี่ยน role ไม่สำเร็จ: ${error.message}`);
      return;
    }
    await loadData();
    if (p.id === me?.id) refreshMe();
  }

  async function savePhone(p: Profile, phone: string) {
    const trimmed = phone.trim();
    if (trimmed === (p.phone ?? "")) return;
    setSavingId(p.id);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: trimmed || null, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setSavingId(null);
    if (error) {
      window.alert(`บันทึกเบอร์โทรไม่สำเร็จ: ${error.message}`);
      return;
    }
    await loadData();
    if (p.id === me?.id) refreshMe();
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">จัดการพนักงาน</h1>
      </div>

      <div className="card mb-4 flex items-start gap-3 p-4 text-sm text-neutral-600">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={2} />
        <p>
          เพิ่มพนักงานใหม่ได้ที่ Supabase Dashboard{" "}
          <span className="text-neutral-400">→</span> Authentication{" "}
          <span className="text-neutral-400">→</span> Users แล้วกลับมากำหนด
          role ที่หน้านี้ (บัญชีใหม่จะได้สิทธิ์ “พนักงานขาย” เป็นค่าเริ่มต้น)
        </p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-neutral-400">กำลังโหลด...</p>
      ) : loadError ? (
        <div className="py-16 text-center text-red-500">
          <AlertCircle className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p className="mb-3 text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={loadData}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      ) : staff.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Users className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>ยังไม่มีพนักงาน</p>
        </div>
      ) : (
        <>
          {/* ตารางสำหรับจอใหญ่ */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="px-4 py-3 font-medium">อีเมล</th>
                  <th className="px-4 py-3 font-medium">เบอร์โทร</th>
                  <th className="px-4 py-3 font-medium">เข้าร่วมเมื่อ</th>
                  <th className="px-4 py-3 font-medium">สิทธิ์การใช้งาน</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.email ?? "-"}</p>
                      {p.id === me?.id && (
                        <p className="text-xs text-brand-600">คุณ</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PhoneInput
                        value={p.phone}
                        disabled={savingId === p.id}
                        onSave={(phone) => savePhone(p, phone)}
                      />
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <RoleSelect
                        value={p.role}
                        disabled={savingId === p.id}
                        onChange={(role) => changeRole(p, role)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* การ์ดสำหรับมือถือ */}
          <div className="space-y-3 md:hidden">
            {staff.map((p) => (
              <div key={p.id} className="card p-4">
                <p className="font-semibold">
                  {p.email ?? "-"}
                  {p.id === me?.id && (
                    <span className="ml-2 text-xs font-normal text-brand-600">
                      (คุณ)
                    </span>
                  )}
                </p>
                <p className="mb-3 text-xs text-neutral-400">
                  เข้าร่วมเมื่อ {formatDate(p.created_at)}
                </p>
                <div className="space-y-2">
                  <PhoneInput
                    value={p.phone}
                    disabled={savingId === p.id}
                    onSave={(phone) => savePhone(p, phone)}
                  />
                  <RoleSelect
                    value={p.role}
                    disabled={savingId === p.id}
                    onChange={(role) => changeRole(p, role)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PhoneInput({
  value,
  disabled,
  onSave,
}: {
  value: string | null;
  disabled: boolean;
  onSave: (phone: string) => void;
}) {
  const [text, setText] = useState(value ?? "");

  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  return (
    <div className="relative w-full max-w-[220px]">
      <Phone
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        strokeWidth={2}
      />
      <input
        type="tel"
        className="input py-2 pl-9"
        placeholder="ยังไม่ระบุ"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text)}
      />
    </div>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: Role;
  disabled: boolean;
  onChange: (role: Role) => void;
}) {
  return (
    <select
      className="input w-full max-w-[220px] py-2"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Role)}
    >
      {ROLE_ORDER.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
