"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber, daysAgo, toDateInput } from "@/lib/format";
import {
  ExpenseWithCategory,
  IncomeWithCategory,
  PAYMENT_LABELS,
  PaymentMethod,
  Product,
  SaleWithItems,
} from "@/lib/types";
import RequireRole from "@/components/RequireRole";

const PAYMENT_ICONS: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  transfer: Smartphone,
  card: CreditCard,
};

type Period = "today" | "7d" | "30d" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  today: "วันนี้",
  "7d": "7 วันล่าสุด",
  "30d": "30 วันล่าสุด",
  month: "เดือนนี้",
};

function periodStart(p: Period): Date {
  const now = new Date();
  switch (p) {
    case "today":
      return now;
    case "7d":
      return daysAgo(6);
    case "30d":
      return daysAgo(29);
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

export default function DashboardPage() {
  return (
    <RequireRole min="manager">
      <DashboardPageContent />
    </RequireRole>
  );
}

function DashboardPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>("today");
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [income, setIncome] = useState<IncomeWithCategory[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const start = periodStart(period);
      start.setHours(0, 0, 0, 0);
      const fromISO = start.toISOString();
      const fromDate = toDateInput(start);
      const [salesRes, expensesRes, incomeRes, lowRes] = await Promise.all([
        supabase
          .from("sales")
          .select("*, sale_items(*)")
          .eq("status", "completed")
          .gte("created_at", fromISO)
          .order("created_at"),
        supabase
          .from("expenses")
          .select("*, expense_categories(name)")
          .gte("expense_date", fromDate)
          .order("expense_date"),
        supabase
          .from("income")
          .select("*, income_categories(name)")
          .gte("income_date", fromDate)
          .order("income_date"),
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .eq("track_stock", true)
          .order("stock"),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (incomeRes.error) throw incomeRes.error;
      if (lowRes.error) throw lowRes.error;
      setSales((salesRes.data as SaleWithItems[]) ?? []);
      setExpenses((expensesRes.data as ExpenseWithCategory[]) ?? []);
      setIncome((incomeRes.data as IncomeWithCategory[]) ?? []);
      const products = (lowRes.data as Product[]) ?? [];
      setLowStock(products.filter((p) => p.stock <= p.low_stock_threshold));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const cost = sales.reduce((s, x) => s + Number(x.cost_total), 0);
  const grossProfit = revenue - cost;
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const incomeTotal = income.reduce((s, i) => s + Number(i.amount), 0);
  const netProfit = grossProfit + incomeTotal - expenseTotal;
  const billCount = sales.length;
  const avgPerBill = billCount > 0 ? revenue / billCount : 0;

  // รายจ่ายแยกตามหมวดหมู่
  const byExpenseCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const name = e.expense_categories?.name ?? "ไม่ระบุหมวดหมู่";
      map.set(name, (map.get(name) ?? 0) + Number(e.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // ยอดขายรายวันสำหรับกราฟ
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + Number(s.total));
    }
    const days: { label: string; value: number }[] = [];
    const start = periodStart(period);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.push({
        label: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
        value: map.get(key) ?? 0,
      });
    }
    return days;
  }, [sales, period]);

  // สินค้าขายดี
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const s of sales) {
      for (const item of s.sale_items) {
        const key = item.product_id ?? item.product_name;
        const cur = map.get(key) ?? { name: item.product_name, qty: 0, total: 0 };
        cur.qty += Number(item.quantity);
        cur.total += Number(item.total);
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  // แยกตามวิธีชำระเงิน
  const byPayment = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    for (const s of sales) {
      map.set(s.payment_method, (map.get(s.payment_method) ?? 0) + Number(s.total));
    }
    return map;
  }, [sales]);

  const maxDaily = Math.max(...dailyData.map((d) => d.value), 1);

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">ภาพรวมร้าน</h1>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                period === p
                  ? "bg-brand-600 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
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
      ) : (
        <div className="space-y-4">
          {/* ตัวเลขสรุป */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-7">
            <StatCard label="ยอดขาย" value={baht(revenue)} accent="text-brand-600" />
            <StatCard label="ต้นทุนสินค้า" value={baht(cost)} accent="text-neutral-700" />
            <StatCard
              label="กำไรขั้นต้น"
              value={baht(grossProfit)}
              accent="text-sand-700"
            />
            <StatCard
              label="รายได้อื่นๆ"
              value={baht(incomeTotal)}
              accent="text-green-600"
            />
            <StatCard
              label="รายจ่ายอื่นๆ"
              value={baht(expenseTotal)}
              accent="text-red-600"
            />
            <StatCard
              label="กำไรสุทธิ"
              value={baht(netProfit)}
              accent={netProfit >= 0 ? "text-green-600" : "text-red-600"}
            />
            <StatCard
              label={`จำนวนบิล (เฉลี่ย ${baht(avgPerBill)}/บิล)`}
              value={formatNumber(billCount)}
              accent="text-neutral-900"
            />
          </div>

          {/* กราฟยอดขายรายวัน */}
          <div className="card p-4 md:p-5">
            <h2 className="mb-4 font-bold">ยอดขายรายวัน</h2>
            {dailyData.every((d) => d.value === 0) ? (
              <p className="py-8 text-center text-sm text-neutral-400">
                ยังไม่มียอดขายในช่วงนี้
              </p>
            ) : (
              <div className="flex h-44 items-end gap-1 overflow-x-auto md:gap-2">
                {dailyData.map((d, i) => (
                  <div
                    key={i}
                    className="flex min-w-8 flex-1 flex-col items-center gap-1"
                    title={`${d.label}: ${baht(d.value)}`}
                  >
                    <span className="text-[10px] text-neutral-500">
                      {d.value > 0 ? formatNumber(Math.round(d.value)) : ""}
                    </span>
                    <div
                      className="w-full max-w-14 rounded-t-lg bg-brand-500 transition hover:bg-brand-600"
                      style={{
                        height: `${Math.max((d.value / maxDaily) * 130, d.value > 0 ? 4 : 1)}px`,
                      }}
                    />
                    <span className="text-[10px] text-neutral-400">{d.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* สินค้าขายดี */}
            <div className="card p-4 md:p-5">
              <h2 className="mb-3 font-bold">สินค้าขายดี Top 5</h2>
              {topProducts.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">
                  ยังไม่มีข้อมูล
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {topProducts.map((p, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0
                            ? "bg-sand-200 text-sand-800"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-neutral-400">
                          ขายแล้ว {formatNumber(p.qty)} ชิ้น
                        </p>
                      </div>
                      <span className="font-semibold">{baht(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              {/* แยกตามวิธีชำระ */}
              <div className="card p-4 md:p-5">
                <h2 className="mb-3 font-bold">แยกตามวิธีชำระเงิน</h2>
                {byPayment.size === 0 ? (
                  <p className="py-4 text-center text-sm text-neutral-400">
                    ยังไม่มีข้อมูล
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {[...byPayment.entries()].map(([m, v]) => {
                      const Icon = PAYMENT_ICONS[m];
                      return (
                        <li
                          key={m}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2 text-sm text-neutral-600">
                            <Icon className="h-4 w-4" strokeWidth={2} />
                            {PAYMENT_LABELS[m] ?? m}
                          </span>
                          <span className="font-semibold">{baht(v)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* รายจ่ายตามหมวดหมู่ */}
              <div className="card p-4 md:p-5">
                <h2 className="mb-3 font-bold">รายจ่ายตามหมวดหมู่</h2>
                {byExpenseCategory.length === 0 ? (
                  <p className="py-4 text-center text-sm text-neutral-400">
                    ยังไม่มีรายจ่ายในช่วงนี้
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {byExpenseCategory.map(([name, amount]) => (
                      <li key={name} className="flex items-center justify-between">
                        <span className="truncate text-sm text-neutral-600">
                          {name}
                        </span>
                        <span className="ml-2 shrink-0 font-semibold text-red-600">
                          {baht(amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* สินค้าใกล้หมด */}
              <div className="card p-4 md:p-5">
                <h2 className="mb-3 font-bold">
                  สินค้าใกล้หมด{" "}
                  {lowStock.length > 0 && (
                    <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {lowStock.length}
                    </span>
                  )}
                </h2>
                {lowStock.length === 0 ? (
                  <p className="flex items-center justify-center gap-1.5 py-4 text-center text-sm text-neutral-400">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    สต๊อกสินค้าปกติดี
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {lowStock.slice(0, 6).map((p) => (
                      <li key={p.id} className="flex items-center justify-between">
                        <span className="truncate text-sm text-neutral-600">
                          {p.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            p.stock <= 0
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          เหลือ {formatNumber(p.stock)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-500 md:text-sm">{label}</p>
      <p className={`mt-1 text-xl font-bold md:text-2xl ${accent}`}>{value}</p>
    </div>
  );
}
