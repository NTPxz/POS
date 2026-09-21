"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber, daysAgo, toDateInput } from "@/lib/format";
import { Expense, Income, Sale } from "@/lib/types";
import RequireRole from "@/components/RequireRole";
import { useBranch } from "@/components/BranchProvider";

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

export default function SummaryPage() {
  return (
    <RequireRole min="owner">
      <SummaryPageContent />
    </RequireRole>
  );
}

type BranchTotals = {
  branchId: string;
  branchName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  expenseTotal: number;
  incomeTotal: number;
  netProfit: number;
  billCount: number;
};

function SummaryPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const { branches } = useBranch();
  const [period, setPeriod] = useState<Period>("today");
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // หน้านี้เป็น owner-only และไม่กรองตามสาขาที่กำลังทำงานอยู่ — ดึงข้อมูล "ทุกสาขา" มาเทียบกัน
  // (is_owner() ใน RLS อนุญาตให้เห็นทุกสาขาอยู่แล้ว ต่างจากหน้าอื่นๆ ที่ล็อกตามสาขาที่เลือก)
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const start = periodStart(period);
      start.setHours(0, 0, 0, 0);
      const fromISO = start.toISOString();
      const fromDate = toDateInput(start);
      const [salesRes, expensesRes, incomeRes] = await Promise.all([
        supabase
          .from("sales")
          .select("branch_id, total, cost_total")
          .eq("status", "completed")
          .gte("created_at", fromISO),
        supabase
          .from("expenses")
          .select("branch_id, amount")
          .gte("expense_date", fromDate),
        supabase
          .from("income")
          .select("branch_id, amount")
          .gte("income_date", fromDate),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (incomeRes.error) throw incomeRes.error;
      setSales((salesRes.data as Sale[]) ?? []);
      setExpenses((expensesRes.data as Expense[]) ?? []);
      setIncome((incomeRes.data as Income[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const perBranch = useMemo<BranchTotals[]>(() => {
    return branches.map((b) => {
      const branchSales = sales.filter((s) => s.branch_id === b.id);
      const branchExpenses = expenses.filter((e) => e.branch_id === b.id);
      const branchIncome = income.filter((i) => i.branch_id === b.id);
      const revenue = branchSales.reduce((s, x) => s + Number(x.total), 0);
      const cost = branchSales.reduce((s, x) => s + Number(x.cost_total), 0);
      const grossProfit = revenue - cost;
      const expenseTotal = branchExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const incomeTotal = branchIncome.reduce((s, i) => s + Number(i.amount), 0);
      return {
        branchId: b.id,
        branchName: b.name,
        revenue,
        cost,
        grossProfit,
        expenseTotal,
        incomeTotal,
        netProfit: grossProfit + incomeTotal - expenseTotal,
        billCount: branchSales.length,
      };
    });
  }, [branches, sales, expenses, income]);

  const combined = useMemo(() => {
    return perBranch.reduce(
      (acc, b) => ({
        revenue: acc.revenue + b.revenue,
        cost: acc.cost + b.cost,
        grossProfit: acc.grossProfit + b.grossProfit,
        expenseTotal: acc.expenseTotal + b.expenseTotal,
        incomeTotal: acc.incomeTotal + b.incomeTotal,
        netProfit: acc.netProfit + b.netProfit,
        billCount: acc.billCount + b.billCount,
      }),
      { revenue: 0, cost: 0, grossProfit: 0, expenseTotal: 0, incomeTotal: 0, netProfit: 0, billCount: 0 }
    );
  }, [perBranch]);

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">รวมยอดทุกสาขา</h1>
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
          {/* ยอดรวมทุกสาขา */}
          <div className="card p-4 md:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Building2 className="h-5 w-5 text-brand-600" strokeWidth={2} />
              รวมทุกสาขา
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="ยอดขาย" value={baht(combined.revenue)} accent="text-brand-600" />
              <StatCard
                label="กำไรขั้นต้น"
                value={baht(combined.grossProfit)}
                accent="text-sand-700"
              />
              <StatCard
                label="กำไรสุทธิ"
                value={baht(combined.netProfit)}
                accent={combined.netProfit >= 0 ? "text-green-600" : "text-red-600"}
              />
              <StatCard label="จำนวนบิล" value={formatNumber(combined.billCount)} accent="text-neutral-900" />
            </div>
          </div>

          {/* แยกตามสาขา */}
          <div className="grid gap-4 lg:grid-cols-2">
            {perBranch.map((b) => (
              <div key={b.branchId} className="card p-4 md:p-5">
                <h2 className="mb-3 font-bold">{b.branchName}</h2>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-500">ยอดขาย</span>
                    <span className="font-semibold text-brand-600">{baht(b.revenue)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-500">ต้นทุนสินค้า</span>
                    <span className="font-medium">{baht(b.cost)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-500">กำไรขั้นต้น</span>
                    <span className="font-semibold text-sand-700">{baht(b.grossProfit)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-500">รายได้อื่นๆ</span>
                    <span className="font-medium text-green-600">{baht(b.incomeTotal)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-500">รายจ่ายอื่นๆ</span>
                    <span className="font-medium text-red-600">{baht(b.expenseTotal)}</span>
                  </li>
                  <li className="flex items-center justify-between border-t border-neutral-100 pt-2">
                    <span className="font-semibold text-neutral-700">กำไรสุทธิ</span>
                    <span
                      className={`text-lg font-bold ${
                        b.netProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {baht(b.netProfit)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between text-xs text-neutral-400">
                    <span>จำนวนบิล</span>
                    <span>{formatNumber(b.billCount)}</span>
                  </li>
                </ul>
              </div>
            ))}
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
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg font-bold md:text-xl ${accent}`}>{value}</p>
    </div>
  );
}
