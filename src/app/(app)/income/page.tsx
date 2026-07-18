"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Plus,
  RefreshCw,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatDate, formatNumber, toDateInput } from "@/lib/format";
import { Income, IncomeCategory, IncomeWithCategory } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

function startOfMonthInput(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function IncomePage() {
  return (
    <RequireRole min="manager">
      <IncomePageContent />
    </RequireRole>
  );
}

function IncomePageContent() {
  const supabase = useMemo(() => createClient(), []);
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(startOfMonthInput());
  const [to, setTo] = useState(today);
  const [income, setIncome] = useState<IncomeWithCategory[]>([]);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeWithCategory | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [incRes, catRes] = await Promise.all([
        supabase
          .from("income")
          .select("*, income_categories(name)")
          .gte("income_date", from)
          .lte("income_date", to)
          .order("income_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("income_categories").select("*").order("position"),
      ]);
      if (incRes.error) throw incRes.error;
      if (catRes.error) throw catRes.error;
      setIncome((incRes.data as IncomeWithCategory[]) ?? []);
      setCategories((catRes.data as IncomeCategory[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, from, to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredIncome = useMemo(() => {
    const q = search.trim().toLowerCase();
    return income.filter((i) => {
      if (categoryId && i.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [income, search, categoryId]);

  const total = filteredIncome.reduce((s, i) => s + Number(i.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of filteredIncome) {
      const name = i.income_categories?.name ?? "ไม่ระบุหมวดหมู่";
      map.set(name, (map.get(name) ?? 0) + Number(i.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredIncome]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(i: IncomeWithCategory) {
    setEditing(i);
    setModalOpen(true);
  }

  async function handleDelete(i: Income) {
    if (!window.confirm(`ลบรายได้ "${i.title}" ยอด ${baht(Number(i.amount))} ?`))
      return;
    await supabase.from("income").delete().eq("id", i.id);
    loadData();
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">รายได้</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              className="input w-auto py-2"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="text-neutral-400">ถึง</span>
            <input
              type="date"
              className="input w-auto py-2"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => setCatModalOpen(true)}
          >
            <Tag className="h-4 w-4" strokeWidth={2} />
            หมวดหมู่
          </button>
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            บันทึกรายได้
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        สำหรับรายได้อื่นนอกเหนือจากยอดขายหน้าร้าน (ซึ่งระบบนับให้อัตโนมัติแล้วในหน้า
        “ภาพรวม”) เช่น เงินลงทุนเพิ่ม หรือรายได้ค่าบริการ
      </p>

      {/* ค้นหาและกรองตามหมวดหมู่ */}
      <div className="mb-4 space-y-3">
        <input
          className="input max-w-md"
          placeholder="ค้นหารายการ หรือหมายเหตุ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <CategoryChip
            label="ทั้งหมด"
            active={categoryId === null}
            onClick={() => setCategoryId(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            />
          ))}
        </div>
      </div>

      {/* สรุปช่วงที่เลือก */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-neutral-500 md:text-sm">จำนวนรายการ</p>
          <p className="text-lg font-bold md:text-2xl">
            {formatNumber(filteredIncome.length)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500 md:text-sm">รายได้รวม</p>
          <p className="text-lg font-bold text-green-600 md:text-2xl">
            {baht(total)}
          </p>
        </div>
        <div className="card col-span-2 p-4 md:col-span-1">
          <p className="mb-1 text-xs text-neutral-500 md:text-sm">แยกตามหมวดหมู่</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-neutral-400">-</p>
          ) : (
            <ul className="space-y-0.5">
              {byCategory.slice(0, 3).map(([name, amount]) => (
                <li key={name} className="flex justify-between text-sm">
                  <span className="truncate text-neutral-600">{name}</span>
                  <span className="ml-2 shrink-0 font-medium">{baht(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
      ) : filteredIncome.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <TrendingUp className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>
            {income.length === 0
              ? "ไม่มีรายได้ในช่วงวันที่เลือก"
              : "ไม่พบรายได้ที่ตรงกับตัวกรอง"}
          </p>
        </div>
      ) : (
        <>
          {/* ตารางสำหรับจอใหญ่ */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="px-4 py-3 font-medium">วันที่</th>
                  <th className="px-4 py-3 font-medium">รายการ</th>
                  <th className="px-4 py-3 font-medium">หมวดหมู่</th>
                  <th className="px-4 py-3 text-right font-medium">จำนวนเงิน</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredIncome.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 text-neutral-500">
                      {formatDate(i.income_date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.title}</p>
                      {i.note && (
                        <p className="text-xs text-neutral-400">{i.note}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {i.income_categories?.name ?? "ไม่ระบุหมวดหมู่"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {baht(Number(i.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="mr-1 rounded-lg px-3 py-1.5 text-brand-600 hover:bg-brand-50"
                        onClick={() => openEdit(i)}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="rounded-lg px-3 py-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(i)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* การ์ดสำหรับมือถือ */}
          <div className="space-y-3 md:hidden">
            {filteredIncome.map((i) => (
              <div key={i.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{i.title}</p>
                    <p className="text-xs text-neutral-400">
                      {formatDate(i.income_date)} ·{" "}
                      {i.income_categories?.name ?? "ไม่ระบุหมวดหมู่"}
                    </p>
                    {i.note && (
                      <p className="mt-1 text-xs text-neutral-400">{i.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-bold text-green-600">
                    {baht(Number(i.amount))}
                  </span>
                </div>
                <div className="mt-3 flex justify-end gap-1">
                  <button
                    className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600"
                    onClick={() => openEdit(i)}
                  >
                    แก้ไข
                  </button>
                  <button
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-500"
                    onClick={() => handleDelete(i)}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <IncomeModal
          income={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            loadData();
          }}
        />
      )}

      {catModalOpen && (
        <IncomeCategoryModal
          categories={categories}
          onClose={() => setCatModalOpen(false)}
          onChanged={loadData}
        />
      )}
    </div>
  );
}

type IncomeForm = {
  title: string;
  category_id: string;
  amount: string;
  income_date: string;
  note: string;
};

function IncomeModal({
  income,
  categories,
  onClose,
  onSaved,
}: {
  income: IncomeWithCategory | null;
  categories: IncomeCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<IncomeForm>(
    income
      ? {
          title: income.title,
          category_id: income.category_id ?? "",
          amount: String(income.amount),
          income_date: income.income_date,
          note: income.note ?? "",
        }
      : {
          title: "",
          category_id: "",
          amount: "",
          income_date: toDateInput(new Date()),
          note: "",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<IncomeForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      category_id: form.category_id || null,
      amount: parseFloat(form.amount) || 0,
      income_date: form.income_date,
      note: form.note.trim() || null,
    };
    const { error } = income
      ? await supabase.from("income").update(payload).eq("id", income.id)
      : await supabase.from("income").insert(payload);
    if (error) {
      setError(`บันทึกไม่สำเร็จ: ${error.message}`);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <form
        onSubmit={save}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">
            {income ? "แก้ไขรายได้" : "บันทึกรายได้"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <Field label="รายการ *">
            <input
              className="input"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="เช่น เงินลงทุนเพิ่ม, ค่าบริการพิเศษ"
              required
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="จำนวนเงิน (บาท) *">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="input"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
                required
              />
            </Field>
            <Field label="วันที่ *">
              <input
                type="date"
                className="input"
                value={form.income_date}
                onChange={(e) => set({ income_date: e.target.value })}
                required
              />
            </Field>
          </div>

          <Field label="หมวดหมู่">
            <select
              className="input"
              value={form.category_id}
              onChange={(e) => set({ category_id: e.target.value })}
            >
              <option value="">— ไม่ระบุ —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="หมายเหตุ">
            <input
              className="input"
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
            />
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
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}

function IncomeCategoryModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: IncomeCategory[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("income_categories").insert({
      name: name.trim(),
      position: categories.length + 1,
    });
    setName("");
    setSaving(false);
    onChanged();
  }

  async function removeCategory(c: IncomeCategory) {
    if (
      !window.confirm(
        `ลบหมวดหมู่ "${c.name}" ?\n(รายได้ในหมวดนี้จะกลายเป็น “ไม่ระบุหมวดหมู่”)`
      )
    )
      return;
    await supabase.from("income_categories").delete().eq("id", c.id);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">หมวดหมู่รายได้</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={addCategory} className="mb-4 flex gap-2">
            <input
              className="input flex-1"
              placeholder="ชื่อหมวดหมู่ใหม่..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !name.trim()}
            >
              เพิ่ม
            </button>
          </form>

          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">
              ยังไม่มีหมวดหมู่
            </p>
          ) : (
            <ul className="space-y-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <span className="font-medium">{c.name}</span>
                  <button
                    className="text-sm text-red-500 hover:underline"
                    onClick={() => removeCategory(c)}
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-200 p-4 px-6">
          <button className="btn-secondary w-full" onClick={onClose}>
            ปิด
          </button>
        </div>
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

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {label}
    </button>
  );
}
