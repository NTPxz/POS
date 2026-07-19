"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Info,
  KeyRound,
  Phone,
  Plus,
  RefreshCw,
  UserRound,
  Users,
  X,
} from "lucide-react";
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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);

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

  async function saveFullName(p: Profile, fullName: string) {
    const trimmed = fullName.trim();
    if (trimmed === (p.full_name ?? "")) return;
    setSavingId(p.id);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: trimmed || null, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setSavingId(null);
    if (error) {
      window.alert(`บันทึกชื่อพนักงานไม่สำเร็จ: ${error.message}`);
      return;
    }
    await loadData();
    if (p.id === me?.id) refreshMe();
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">จัดการพนักงาน</h1>
        <button
          className="btn-primary inline-flex items-center gap-2"
          onClick={() => setAddModalOpen(true)}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          เพิ่มพนักงาน
        </button>
      </div>

      <div className="card mb-4 flex items-start gap-3 p-4 text-sm text-neutral-600">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={2} />
        <p>
          กด “เพิ่มพนักงาน” เพื่อสร้างบัญชีให้พนักงานได้เลยในนี้ — ตั้งเบอร์โทร
          และรหัสผ่านให้เอง ไม่ต้องมีอีเมลก็สร้างได้ พนักงานใช้{" "}
          <b>เบอร์โทร + รหัสผ่าน</b> ที่กำหนดไว้ล็อกอินได้ทันที
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
                  <th className="px-4 py-3 font-medium">ชื่อพนักงาน</th>
                  <th className="px-4 py-3 font-medium">อีเมล</th>
                  <th className="px-4 py-3 font-medium">เบอร์โทร</th>
                  <th className="px-4 py-3 font-medium">เข้าร่วมเมื่อ</th>
                  <th className="px-4 py-3 font-medium">สิทธิ์การใช้งาน</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <NameInput
                        value={p.full_name}
                        disabled={savingId === p.id}
                        onSave={(name) => saveFullName(p, name)}
                      />
                      {p.id === me?.id && (
                        <p className="text-xs text-brand-600">คุณ</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{p.email ?? "-"}</td>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-brand-600 hover:bg-brand-50"
                        onClick={() => setResetTarget(p)}
                      >
                        <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                        เปลี่ยนรหัสผ่าน
                      </button>
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
                  {p.full_name || "ยังไม่ระบุชื่อ"}
                  {p.id === me?.id && (
                    <span className="ml-2 text-xs font-normal text-brand-600">
                      (คุณ)
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">{p.email ?? "-"}</p>
                <p className="mb-3 text-xs text-neutral-400">
                  เข้าร่วมเมื่อ {formatDate(p.created_at)}
                </p>
                <div className="space-y-2">
                  <NameInput
                    value={p.full_name}
                    disabled={savingId === p.id}
                    onSave={(name) => saveFullName(p, name)}
                  />
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
                  <button
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2 text-sm font-medium text-brand-600"
                    onClick={() => setResetTarget(p)}
                  >
                    <KeyRound className="h-4 w-4" strokeWidth={2} />
                    เปลี่ยนรหัสผ่าน
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {addModalOpen && (
        <AddStaffModal
          onClose={() => setAddModalOpen(false)}
          onCreated={() => {
            setAddModalOpen(false);
            loadData();
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          staff={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function NameInput({
  value,
  disabled,
  onSave,
}: {
  value: string | null;
  disabled: boolean;
  onSave: (name: string) => void;
}) {
  const [text, setText] = useState(value ?? "");

  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  return (
    <div className="relative w-full max-w-[220px]">
      <UserRound
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        strokeWidth={2}
      />
      <input
        type="text"
        className="input py-2 pl-9"
        placeholder="ยังไม่ระบุชื่อ"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text)}
        maxLength={100}
      />
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
        maxLength={20}
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

type AddStaffForm = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  role: Role;
};

function AddStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<AddStaffForm>({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    role: "staff",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<AddStaffForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "สร้างพนักงานไม่สำเร็จ");
      setSaving(false);
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <form
        onSubmit={save}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">เพิ่มพนักงาน</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <Field label="ชื่อพนักงาน">
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => set({ fullName: e.target.value })}
              placeholder="ไม่บังคับ"
              autoFocus
              maxLength={100}
            />
          </Field>

          <Field label="เบอร์โทร *">
            <input
              type="tel"
              className="input"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="0812345678"
              required
              maxLength={20}
            />
          </Field>

          <Field label="รหัสผ่าน * (อย่างน้อย 6 ตัวอักษร)">
            <input
              type="text"
              className="input"
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              placeholder="ตั้งรหัสผ่านให้พนักงาน"
              minLength={6}
              maxLength={72}
              required
            />
          </Field>

          <Field label="อีเมล (ไม่บังคับ)">
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="เว้นว่างได้ถ้าใช้แค่เบอร์โทรล็อกอิน"
              maxLength={100}
            />
          </Field>

          <Field label="สิทธิ์การใช้งาน">
            <select
              className="input"
              value={form.role}
              onChange={(e) => set({ role: e.target.value as Role })}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-neutral-200 p-4 px-6">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? "กำลังสร้าง..." : "สร้างพนักงาน"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordModal({
  staff,
  onClose,
}: {
  staff: Profile;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/staff/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: staff.id, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setSaving(false);
      return;
    }
    setDone(true);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-sm flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">เปลี่ยนรหัสผ่าน</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-6">
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              เปลี่ยนรหัสผ่านให้ {staff.email ?? staff.phone} เรียบร้อยแล้ว
            </p>
            <button className="btn-primary mt-4 w-full" onClick={onClose}>
              ปิด
            </button>
          </div>
        ) : (
          <form onSubmit={save} className="flex flex-col">
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm text-neutral-500">
                ตั้งรหัสผ่านใหม่ให้ {staff.email ?? staff.phone ?? "พนักงานคนนี้"}
              </p>
              <Field label="รหัสผ่านใหม่ * (อย่างน้อย 6 ตัวอักษร)">
                <input
                  type="text"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  maxLength={72}
                  required
                  autoFocus
                />
              </Field>
              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-2 border-t border-neutral-200 p-4 px-6">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={onClose}
              >
                ยกเลิก
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
    </div>
  );
}
