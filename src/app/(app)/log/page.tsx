"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, History, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber, toDateInput } from "@/lib/format";
import { ActivityLog } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

export default function LogPage() {
  return (
    <RequireRole min="owner">
      <LogPageContent />
    </RequireRole>
  );
}

const ACTION_STYLES: Record<string, string> = {
  insert: "bg-green-100 text-green-700",
  update: "bg-brand-100 text-brand-700",
  delete: "bg-red-100 text-red-600",
  checkout: "bg-green-100 text-green-700",
  void: "bg-red-100 text-red-600",
  order: "bg-sand-200 text-sand-800",
  edit_item: "bg-amber-100 text-amber-700",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "เพิ่ม",
  update: "แก้ไข",
  delete: "ลบ",
  checkout: "ขาย/ปิดบิล",
  void: "ยกเลิก",
  order: "สั่งอาหาร",
  edit_item: "แก้ไขรายการ",
};

function startOfMonthInput(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function LogPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(startOfMonthInput());
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fromISO = new Date(`${from}T00:00:00`).toISOString();
      const toISO = new Date(`${to}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setLogs((data as ActivityLog[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, from, to]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        (l.actor_email ?? "").toLowerCase().includes(q) ||
        l.table_name.toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Log กิจกรรม</h1>
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

      <p className="mb-4 text-sm text-neutral-500">
        บันทึกทุกการเพิ่ม/แก้ไข/ลบในระบบอัตโนมัติ ทั้งสินค้า หมวดหมู่
        รายรับ-รายจ่าย โต๊ะ พนักงาน และการขาย — หน้านี้เห็นได้เฉพาะเจ้าของร้าน
      </p>

      <input
        className="input mb-4 max-w-md"
        placeholder="ค้นหาข้อความ, อีเมลผู้ทำรายการ, หรือตาราง..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={100}
      />

      <div className="mb-4 card p-4">
        <p className="text-xs text-neutral-500 md:text-sm">จำนวนรายการ</p>
        <p className="text-lg font-bold md:text-2xl">
          {formatNumber(filtered.length)}
          {logs.length >= 500 && (
            <span className="ml-2 text-xs font-normal text-neutral-400">
              (แสดงล่าสุด 500 รายการ)
            </span>
          )}
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
            onClick={loadLogs}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <History className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>
            {logs.length === 0
              ? "ไม่มีกิจกรรมในช่วงวันที่เลือก"
              : "ไม่พบกิจกรรมที่ตรงกับคำค้นหา"}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((log) => (
            <li
              key={log.id}
              className="card flex items-start gap-3 p-3.5 md:items-center"
            >
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ACTION_STYLES[log.action] ?? "bg-neutral-100 text-neutral-600"
                }`}
              >
                {ACTION_LABELS[log.action] ?? log.action}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-neutral-800">
                  {log.description}
                </p>
                <p className="text-xs text-neutral-400">
                  {log.actor_email ?? "ระบบ"} · {formatDateTime(log.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
