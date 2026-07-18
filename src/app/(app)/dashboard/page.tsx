"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber, startOfDayISO, daysAgo } from "@/lib/format";
import { PAYMENT_LABELS, PaymentMethod, Product, SaleWithItems } from "@/lib/types";

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
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>("today");
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const fromISO = startOfDayISO(periodStart(period));
    const [salesRes, lowRes] = await Promise.all([
      supabase
        .from("sales")
        .select("*, sale_items(*)")
        .eq("status", "completed")
        .gte("created_at", fromISO)
        .order("created_at"),
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("track_stock", true)
        .order("stock"),
    ]);
    setSales((salesRes.data as SaleWithItems[]) ?? []);
    const products = (lowRes.data as Product[]) ?? [];
    setLowStock(products.filter((p) => p.stock <= p.low_stock_threshold));
    setLoading(false);
  }, [supabase, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const cost = sales.reduce((s, x) => s + Number(x.cost_total), 0);
  const profit = revenue - cost;
  const billCount = sales.length;
  const avgPerBill = billCount > 0 ? revenue / billCount : 0;

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
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-slate-400">กำลังโหลด...</p>
      ) : (
        <div className="space-y-4">
          {/* ตัวเลขสรุป */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="ยอดขาย" value={baht(revenue)} accent="text-blue-600" />
            <StatCard label="ต้นทุนสินค้า" value={baht(cost)} accent="text-slate-700" />
            <StatCard label="กำไร" value={baht(profit)} accent="text-green-600" />
            <StatCard
              label={`จำนวนบิล (เฉลี่ย ${baht(avgPerBill)}/บิล)`}
              value={formatNumber(billCount)}
              accent="text-slate-900"
            />
          </div>

          {/* กราฟยอดขายรายวัน */}
          <div className="card p-4 md:p-5">
            <h2 className="mb-4 font-bold">ยอดขายรายวัน</h2>
            {dailyData.every((d) => d.value === 0) ? (
              <p className="py-8 text-center text-sm text-slate-400">
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
                    <span className="text-[10px] text-slate-500">
                      {d.value > 0 ? formatNumber(Math.round(d.value)) : ""}
                    </span>
                    <div
                      className="w-full max-w-14 rounded-t-lg bg-blue-500 transition hover:bg-blue-600"
                      style={{
                        height: `${Math.max((d.value / maxDaily) * 130, d.value > 0 ? 4 : 1)}px`,
                      }}
                    />
                    <span className="text-[10px] text-slate-400">{d.label}</span>
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
                <p className="py-6 text-center text-sm text-slate-400">
                  ยังไม่มีข้อมูล
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {topProducts.map((p, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-slate-400">
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
                  <p className="py-4 text-center text-sm text-slate-400">
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
                          <span className="flex items-center gap-2 text-sm text-slate-600">
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
                  <p className="flex items-center justify-center gap-1.5 py-4 text-center text-sm text-slate-400">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    สต๊อกสินค้าปกติดี
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {lowStock.slice(0, 6).map((p) => (
                      <li key={p.id} className="flex items-center justify-between">
                        <span className="truncate text-sm text-slate-600">
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
      <p className="text-xs text-slate-500 md:text-sm">{label}</p>
      <p className={`mt-1 text-xl font-bold md:text-2xl ${accent}`}>{value}</p>
    </div>
  );
}
