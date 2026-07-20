"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  RefreshCw,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatDateTime } from "@/lib/format";
import { CashShift } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

export default function CashPage() {
  return (
    <RequireRole min="staff">
      <CashPageContent />
    </RequireRole>
  );
}

function CashPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const [openShift, setOpenShift] = useState<CashShift | null | undefined>(undefined);
  const [history, setHistory] = useState<CashShift[]>([]);
  const [cashSales, setCashSales] = useState(0);
  const [cashExpenses, setCashExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [openForm, setOpenForm] = useState({ amount: "", note: "" });
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: shifts, error: shiftErr } = await supabase
        .from("cash_shifts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (shiftErr) throw shiftErr;

      const all = (shifts as CashShift[]) ?? [];
      const current = all.find((s) => s.status === "open") ?? null;
      setOpenShift(current);
      setHistory(all.filter((s) => s.status === "closed"));

      if (current) {
        const [salesRes, expensesRes] = await Promise.all([
          supabase
            .from("sales")
            .select("total")
            .eq("payment_method", "cash")
            .eq("status", "completed")
            .gte("created_at", current.opened_at),
          supabase.from("expenses").select("amount").gte("created_at", current.opened_at),
        ]);
        if (salesRes.error) throw salesRes.error;
        if (expensesRes.error) throw expensesRes.error;
        setCashSales(
          (salesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0)
        );
        setCashExpenses(
          (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
        );
      } else {
        setCashSales(0);
        setCashExpenses(0);
        // ตั้งค่าเริ่มต้นของ "เงินตั้งต้น" ให้เท่ากับยอดปิดกะครั้งล่าสุด
        const lastClosed = all.find((s) => s.status === "closed" && s.closing_amount !== null);
        setOpenForm((f) => ({
          ...f,
          amount: f.amount || (lastClosed ? String(lastClosed.closing_amount) : ""),
        }));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const expectedAmount = openShift
    ? Number(openShift.opening_amount) + cashSales - cashExpenses
    : 0;

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setOpening(true);
    setOpenError(null);
    const amount = parseFloat(openForm.amount) || 0;
    const { error } = await supabase.rpc("open_cash_shift", {
      p_opening_amount: amount,
      p_note: openForm.note.trim() || null,
    });
    setOpening(false);
    if (error) {
      setOpenError(`เปิดกะไม่สำเร็จ: ${error.message}`);
      return;
    }
    setOpenForm({ amount: "", note: "" });
    loadData();
  }

  if (loading && openShift === undefined) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <p className="py-16 text-center text-neutral-400">กำลังโหลด...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 p-4 md:p-6">
        <div className="py-16 text-center text-red-500">
          <AlertCircle className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p className="mb-3 text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          <button className="btn-secondary inline-flex items-center gap-2" onClick={loadData}>
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <h1 className="mb-4 text-xl font-bold md:text-2xl">เงินสดหน้าร้าน</h1>

      {!openShift ? (
        <div className="card mx-auto max-w-md p-5">
          <div className="mb-3 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-brand-600" strokeWidth={2} />
            <h2 className="font-semibold">ยังไม่ได้เปิดกะ</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-500">
            กรอกเงินสดตั้งต้น (เงินทอน) ที่มีอยู่ในลิ้นชักตอนนี้ เพื่อเริ่มนับยอดของกะนี้
          </p>
          <form onSubmit={handleOpen} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                เงินสดตั้งต้น (บาท) *
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="input"
                value={openForm.amount}
                onChange={(e) => setOpenForm((f) => ({ ...f, amount: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                หมายเหตุ (ถ้ามี)
              </label>
              <input
                className="input"
                value={openForm.note}
                onChange={(e) => setOpenForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="เช่น เปิดกะเช้า"
                maxLength={200}
              />
            </div>
            {openError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{openError}</p>
            )}
            <button type="submit" className="btn-primary w-full py-3" disabled={opening}>
              {opening ? "กำลังเปิดกะ..." : "เปิดกะ"}
            </button>
          </form>
        </div>
      ) : (
        <div className="card mx-auto max-w-md p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-brand-600" strokeWidth={2} />
              <h2 className="font-semibold">กะเปิดอยู่</h2>
            </div>
            <span className="text-xs text-neutral-400">
              เปิดเมื่อ {formatDateTime(openShift.opened_at)}
            </span>
          </div>

          <div className="space-y-2 rounded-xl bg-neutral-50 p-4 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>เงินสดตั้งต้น</span>
              <span>{baht(Number(openShift.opening_amount))}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>+ ยอดขายเงินสด</span>
              <span>{baht(cashSales)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>− รายจ่าย</span>
              <span>{baht(cashExpenses)}</span>
            </div>
            <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-900">
              <span>เงินสดที่ควรมีตอนนี้</span>
              <span className="text-lg">{baht(expectedAmount)}</span>
            </div>
          </div>

          <button
            className="btn-secondary mt-2 inline-flex w-full items-center justify-center gap-2 py-2"
            onClick={loadData}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            รีเฟรชยอด
          </button>

          <button
            className="btn-primary mt-3 w-full py-3"
            onClick={() => setCloseModalOpen(true)}
          >
            ปิดกะ / นับเงิน
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mx-auto mt-6 max-w-md">
          <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">
            ประวัติการปิดกะ
          </p>
          <ul className="space-y-2">
            {history.map((s) => {
              const diff = Number(s.difference ?? 0);
              return (
                <li key={s.id} className="card p-3.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">
                      {formatDateTime(s.opened_at)} → {s.closed_at ? formatDateTime(s.closed_at) : "-"}
                    </span>
                    {diff === 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                        ตรง
                      </span>
                    ) : (
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          diff > 0
                            ? "bg-blue-50 text-blue-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                        {diff > 0 ? `เกิน ${baht(diff)}` : `ขาด ${baht(Math.abs(diff))}`}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex justify-between text-neutral-600">
                    <span>ตั้งต้น {baht(Number(s.opening_amount))}</span>
                    <span>คาดว่า {baht(Number(s.expected_amount ?? 0))}</span>
                    <span className="font-semibold text-neutral-900">
                      นับได้ {baht(Number(s.closing_amount ?? 0))}
                    </span>
                  </div>
                  {s.closing_note && (
                    <p className="mt-1 text-xs text-neutral-400">หมายเหตุ: {s.closing_note}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {closeModalOpen && openShift && (
        <CloseShiftModal
          shift={openShift}
          expectedAmount={expectedAmount}
          onClose={() => setCloseModalOpen(false)}
          onDone={() => {
            setCloseModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function CloseShiftModal({
  shift,
  expectedAmount,
  onClose,
  onDone,
}: {
  shift: CashShift;
  expectedAmount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [countedStr, setCountedStr] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counted = parseFloat(countedStr) || 0;
  const diff = countedStr ? counted - expectedAmount : null;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("close_cash_shift", {
      p_shift_id: shift.id,
      p_closing_amount: counted,
      p_note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      setError(`ปิดกะไม่สำเร็จ: ${error.message}`);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <form
        onSubmit={confirm}
        className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">ปิดกะ / นับเงิน</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            เงินสดที่ควรมีตามระบบ:{" "}
            <span className="font-semibold text-neutral-900">{baht(expectedAmount)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              นับเงินสดได้จริง (บาท) *
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              className="input text-right text-lg font-semibold"
              value={countedStr}
              onChange={(e) => setCountedStr(e.target.value)}
              required
              autoFocus
            />
          </div>

          {diff !== null && (
            <div
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                diff === 0
                  ? "bg-green-50 text-green-700"
                  : diff > 0
                    ? "bg-blue-50 text-blue-700"
                    : "bg-red-50 text-red-700"
              }`}
            >
              <span className="font-medium">
                {diff === 0 ? "ตรงเป๊ะ" : diff > 0 ? "เงินเกิน" : "เงินขาด"}
              </span>
              <span className="text-lg font-bold">
                {diff === 0 ? "-" : baht(Math.abs(diff))}
              </span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              หมายเหตุ (ถ้ามี)
            </label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น สาเหตุที่ขาด/เกิน"
              maxLength={200}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-neutral-200 p-4 px-6">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "ยืนยันปิดกะ"}
          </button>
        </div>
      </form>
    </div>
  );
}
