"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Receipt, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  baht,
  billNumber,
  formatDateTime,
  formatNumber,
  toDateInput,
} from "@/lib/format";
import { PAYMENT_LABELS, SaleWithItems } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

export default function SalesPage() {
  return (
    <RequireRole min="manager">
      <SalesPageContent />
    </RequireRole>
  );
}

function SalesPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fromISO = new Date(`${from}T00:00:00`).toISOString();
      const toISO = new Date(`${to}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSales((data as SaleWithItems[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, from, to]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const completed = sales.filter((s) => s.status === "completed");
  const totalRevenue = completed.reduce((s, x) => s + Number(x.total), 0);
  const totalProfit = completed.reduce(
    (s, x) => s + (Number(x.total) - Number(x.cost_total)),
    0
  );

  async function voidSale(sale: SaleWithItems) {
    if (
      !window.confirm(
        `ยกเลิกบิล ${billNumber(sale.sale_number)} ยอด ${baht(Number(sale.total))} ?\nสต๊อกสินค้าจะถูกคืนกลับ`
      )
    )
      return;
    const { error } = await supabase.rpc("void_sale", { p_sale_id: sale.id });
    if (error) {
      window.alert(`ยกเลิกบิลไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadSales();
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">ประวัติการขาย</h1>
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
      </div>

      {/* สรุปช่วงที่เลือก */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-neutral-500 md:text-sm">จำนวนบิล</p>
          <p className="text-lg font-bold md:text-2xl">
            {formatNumber(completed.length)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500 md:text-sm">ยอดขาย</p>
          <p className="text-lg font-bold text-brand-600 md:text-2xl">
            {baht(totalRevenue)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500 md:text-sm">กำไร</p>
          <p className="text-lg font-bold text-green-600 md:text-2xl">
            {baht(totalProfit)}
          </p>
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
            onClick={loadSales}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      ) : sales.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Receipt className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>ไม่มีรายการขายในช่วงวันที่เลือก</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sales.map((sale) => {
            const isOpen = expanded === sale.id;
            const voided = sale.status === "voided";
            return (
              <li key={sale.id} className={`card ${voided ? "opacity-60" : ""}`}>
                <button
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : sale.id)}
                >
                  <div>
                    <p className="font-semibold">
                      {billNumber(sale.sale_number)}{" "}
                      {voided && (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                          ยกเลิกแล้ว
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {formatDateTime(sale.created_at)} ·{" "}
                      {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}{" "}
                      · {formatNumber(sale.sale_items.reduce((s, i) => s + Number(i.quantity), 0))}{" "}
                      ชิ้น
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${voided ? "line-through" : ""}`}>
                      {baht(Number(sale.total))}
                    </p>
                    <p className="text-xs text-green-600">
                      กำไร {baht(Number(sale.total) - Number(sale.cost_total))}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-neutral-100 px-4 py-3">
                    <ul className="space-y-1.5 text-sm">
                      {sale.sale_items.map((item) => (
                        <li key={item.id} className="flex justify-between">
                          <span className="text-neutral-600">
                            {item.product_name} × {formatNumber(Number(item.quantity))}
                          </span>
                          <span className="font-medium">
                            {baht(Number(item.total))}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
                      <div className="flex justify-between text-neutral-500">
                        <span>ยอดรวม</span>
                        <span>{baht(Number(sale.subtotal))}</span>
                      </div>
                      {Number(sale.discount) > 0 && (
                        <div className="flex justify-between text-red-500">
                          <span>ส่วนลด</span>
                          <span>-{baht(Number(sale.discount))}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold">
                        <span>ยอดสุทธิ</span>
                        <span>{baht(Number(sale.total))}</span>
                      </div>
                      {sale.received !== null && (
                        <>
                          <div className="flex justify-between text-neutral-500">
                            <span>รับเงิน</span>
                            <span>{baht(Number(sale.received))}</span>
                          </div>
                          <div className="flex justify-between text-neutral-500">
                            <span>เงินทอน</span>
                            <span>{baht(Number(sale.change ?? 0))}</span>
                          </div>
                        </>
                      )}
                      {sale.note && (
                        <p className="pt-1 text-neutral-500">
                          หมายเหตุ: {sale.note}
                        </p>
                      )}
                    </div>
                    {!voided && (
                      <button
                        className="mt-3 w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50"
                        onClick={() => voidSale(sale)}
                      >
                        ยกเลิกบิลนี้ (คืนสต๊อก)
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
