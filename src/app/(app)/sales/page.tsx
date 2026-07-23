"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Receipt, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  baht,
  billNumber,
  formatDateTime,
  formatNumber,
  toDateInput,
} from "@/lib/format";
import { hasRole, PAYMENT_LABELS, SaleWithItems } from "@/lib/types";
import RequireRole from "@/components/RequireRole";
import { useProfile } from "@/components/ProfileProvider";

type SaleRow = SaleWithItems & { dining_tables: { name: string } | null };

export default function SalesPage() {
  return (
    <RequireRole min="staff">
      <SalesPageContent />
    </RequireRole>
  );
}

function SalesPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const isOwner = !!profile && hasRole(profile.role, "owner");
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fromISO = new Date(`${from}T00:00:00`).toISOString();
      const toISO = new Date(`${to}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*), dining_tables(name)")
        .neq("status", "open")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSales((data as SaleRow[]) ?? []);
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

  async function saveCustomerName(saleId: string, name: string) {
    const trimmed = name.trim();
    setSales((prev) =>
      prev.map((s) => (s.id === saleId ? { ...s, customer_name: trimmed || null } : s))
    );
    setEditingNameId(null);
    const { error } = await supabase
      .from("sales")
      .update({ customer_name: trimmed || null })
      .eq("id", saleId);
    if (error) {
      window.alert(`บันทึกชื่อลูกค้าไม่สำเร็จ: ${error.message}`);
      loadSales();
    }
  }

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold md:text-2xl">ประวัติการขาย</h1>
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <input
            type="date"
            className="input w-full py-2 sm:w-auto"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-center text-xs text-neutral-400 sm:text-sm">
            ถึง
          </span>
          <input
            type="date"
            className="input w-full py-2 sm:w-auto"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {/* สรุปช่วงที่เลือก */}
      <div className={`mb-4 grid gap-3 ${isOwner ? "grid-cols-3" : "grid-cols-2"}`}>
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
        {isOwner && (
          <div className="card p-4">
            <p className="text-xs text-neutral-500 md:text-sm">กำไร</p>
            <p className="text-lg font-bold text-green-600 md:text-2xl">
              {baht(totalProfit)}
            </p>
          </div>
        )}
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
                <div
                  className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : sale.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {billNumber(sale.sale_number)}{" "}
                      {sale.dining_tables && (
                        <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                          {sale.dining_tables.name}
                        </span>
                      )}{" "}
                      {voided && (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                          ยกเลิกแล้ว
                        </span>
                      )}
                    </p>
                    {editingNameId === sale.id ? (
                      <input
                        autoFocus
                        className="input mt-1 py-1 text-sm"
                        maxLength={100}
                        defaultValue={sale.customer_name ?? ""}
                        placeholder="ชื่อลูกค้า"
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => saveCustomerName(sale.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditingNameId(null);
                        }}
                      />
                    ) : (
                      <button
                        className="mt-0.5 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNameId(sale.id);
                        }}
                      >
                        <Pencil className="h-3 w-3" strokeWidth={2} />
                        {sale.customer_name || "ใส่ชื่อลูกค้า"}
                      </button>
                    )}
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
                    {isOwner && (
                      <p className="text-xs text-green-600">
                        กำไร {baht(Number(sale.total) - Number(sale.cost_total))}
                      </p>
                    )}
                  </div>
                </div>

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
