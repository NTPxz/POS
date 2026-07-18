"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, RefreshCw, Tag, Wallet, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatDate, formatNumber, toDateInput } from "@/lib/format";
import { Expense, ExpenseCategory, ExpenseWithCategory } from "@/lib/types";

function startOfMonthInput(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function ExpensesPage() {
  const supabase = useMemo(() => createClient(), []);
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(startOfMonthInput());
  const [to, setTo] = useState(today);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithCategory | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [expRes, catRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("*, expense_categories(name)")
          .gte("expense_date", from)
          .lte("expense_date", to)
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("expense_categories").select("*").order("position"),
      ]);
      if (expRes.error) throw expRes.error;
      if (catRes.error) throw catRes.error;
      setExpenses((expRes.data as ExpenseWithCategory[]) ?? []);
      setCategories((catRes.data as ExpenseCategory[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, from, to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const name = e.expense_categories?.name ?? "ไม่ระบุหมวดหมู่";
      map.set(name, (map.get(name) ?? 0) + Number(e.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(e: ExpenseWithCategory) {
    setEditing(e);
    setModalOpen(true);
  }

  async function handleDelete(e: Expense) {
    if (!window.confirm(`ลบรายจ่าย "${e.title}" ยอด ${baht(Number(e.amount))} ?`))
      return;
    await supabase.from("expenses").delete().eq("id", e.id);
    loadData();
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">รายจ่าย / ต้นทุน</h1>
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
            บันทึกรายจ่าย
          </button>
        </div>
      </div>

      {/* สรุปช่วงที่เลือก */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-neutral-500 md:text-sm">จำนวนรายการ</p>
          <p className="text-lg font-bold md:text-2xl">
            {formatNumber(expenses.length)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500 md:text-sm">รายจ่ายรวม</p>
          <p className="text-lg font-bold text-red-600 md:text-2xl">
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
      ) : expenses.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Wallet className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>ไม่มีรายจ่ายในช่วงวันที่เลือก</p>
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
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 text-neutral-500">
                      {formatDate(e.expense_date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.title}</p>
                      {e.note && (
                        <p className="text-xs text-neutral-400">{e.note}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {e.expense_categories?.name ?? "ไม่ระบุหมวดหมู่"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {baht(Number(e.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="mr-1 rounded-lg px-3 py-1.5 text-brand-600 hover:bg-brand-50"
                        onClick={() => openEdit(e)}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="rounded-lg px-3 py-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(e)}
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
            {expenses.map((e) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-neutral-400">
                      {formatDate(e.expense_date)} ·{" "}
                      {e.expense_categories?.name ?? "ไม่ระบุหมวดหมู่"}
                    </p>
                    {e.note && (
                      <p className="mt-1 text-xs text-neutral-400">{e.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-bold text-red-600">
                    {baht(Number(e.amount))}
                  </span>
                </div>
                <div className="mt-3 flex justify-end gap-1">
                  <button
                    className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600"
                    onClick={() => openEdit(e)}
                  >
                    แก้ไข
                  </button>
                  <button
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-500"
                    onClick={() => handleDelete(e)}
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
        <ExpenseModal
          expense={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            loadData();
          }}
        />
      )}

      {catModalOpen && (
        <ExpenseCategoryModal
          categories={categories}
          onClose={() => setCatModalOpen(false)}
          onChanged={loadData}
        />
      )}
    </div>
  );
}

type ExpenseForm = {
  title: string;
  category_id: string;
  amount: string;
  expense_date: string;
  note: string;
};

function ExpenseModal({
  expense,
  categories,
  onClose,
  onSaved,
}: {
  expense: ExpenseWithCategory | null;
  categories: ExpenseCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ExpenseForm>(
    expense
      ? {
          title: expense.title,
          category_id: expense.category_id ?? "",
          amount: String(expense.amount),
          expense_date: expense.expense_date,
          note: expense.note ?? "",
        }
      : {
          title: "",
          category_id: "",
          amount: "",
          expense_date: toDateInput(new Date()),
          note: "",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<ExpenseForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      category_id: form.category_id || null,
      amount: parseFloat(form.amount) || 0,
      expense_date: form.expense_date,
      note: form.note.trim() || null,
    };
    const { error } = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase.from("expenses").insert(payload);
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
            {expense ? "แก้ไขรายจ่าย" : "บันทึกรายจ่าย"}
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
              placeholder="เช่น ซื้อวัตถุดิบ, ค่าเช่าร้านเดือนนี้"
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
                value={form.expense_date}
                onChange={(e) => set({ expense_date: e.target.value })}
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

function ExpenseCategoryModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: ExpenseCategory[];
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
    await supabase.from("expense_categories").insert({
      name: name.trim(),
      position: categories.length + 1,
    });
    setName("");
    setSaving(false);
    onChanged();
  }

  async function removeCategory(c: ExpenseCategory) {
    if (
      !window.confirm(
        `ลบหมวดหมู่ "${c.name}" ?\n(รายจ่ายในหมวดนี้จะกลายเป็น “ไม่ระบุหมวดหมู่”)`
      )
    )
      return;
    await supabase.from("expense_categories").delete().eq("id", c.id);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">หมวดหมู่รายจ่าย</h2>
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
