"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Receipt, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/ProfileProvider";

type Toast = {
  id: string;
  tone: "order" | "bill";
  title: string;
  message: string;
};

const TOAST_MS = 16000;
const BATCH_MS = 900;

// ทำนองแจ้งเตือน — เพลงสั้นๆ วนซ้ำจนยาวรวม ~15 วิ ให้ได้ยินชัดในร้านที่มีเสียงดัง
const ORDER_NOTES = [
  { freq: 523.25, dur: 0.24 }, // C5
  { freq: 659.25, dur: 0.24 }, // E5
  { freq: 783.99, dur: 0.24 }, // G5
  { freq: 1046.5, dur: 0.24 }, // C6
  { freq: 783.99, dur: 0.24 }, // G5
  { freq: 659.25, dur: 0.24 }, // E5
  { freq: 783.99, dur: 0.24 }, // G5
  { freq: 1046.5, dur: 0.5 }, // C6 (โน้ตยาวปิดท้าย)
];
const BILL_NOTES = [
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.23 },
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.23 },
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.23 },
  { freq: 880, dur: 0.23 },
  { freq: 659.25, dur: 0.5 },
];
const MELODY_REPEATS = 6;
const CYCLE_GAP = 0.3;
const NOTE_GAIN_PEAK = 0.65;

export default function OrderNotifications() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { profile } = useProfile();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const pendingRef = useRef<
    Map<string, { saleId: string; items: { name: string; qty: number }[]; timer: ReturnType<typeof setTimeout> | null }>
  >(new Map());
  const notifiedBillRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function unlock() {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      audioCtxRef.current?.resume().catch(() => {});
    }
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playChime = useCallback((tone: "order" | "bill") => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const notes = tone === "bill" ? BILL_NOTES : ORDER_NOTES;
      const cycleDur = notes.reduce((sum, n) => sum + n.dur, 0) + 0.02 * notes.length;

      const now = ctx.currentTime;
      for (let rep = 0; rep < MELODY_REPEATS; rep++) {
        let t = now + rep * (cycleDur + CYCLE_GAP);
        for (const note of notes) {
          const start = t;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = note.freq;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(NOTE_GAIN_PEAK, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + note.dur + 0.02);
          t += note.dur + 0.02;
        }
      }
    } catch {
      // เบราว์เซอร์บางตัวอาจบล็อกก่อน user gesture — ไม่ใช่ error ร้ายแรง ปล่อยผ่าน
    }
  }, []);

  const pushToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, TOAST_MS);
  }, []);

  const resolveTableName = useCallback(
    async (saleId: string) => {
      const { data } = await supabase
        .from("sales")
        .select("table_id, dining_tables(name)")
        .eq("id", saleId)
        .maybeSingle();
      const joined = data?.dining_tables as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(joined) ? joined[0]?.name : joined?.name;
      return name ?? "โต๊ะ";
    },
    [supabase]
  );

  const flushOrder = useCallback(
    async (saleId: string) => {
      const entry = pendingRef.current.get(saleId);
      if (!entry) return;
      pendingRef.current.delete(saleId);
      const tableName = await resolveTableName(saleId);
      const summary = entry.items.map((it) => `${it.name} x${it.qty}`).join(", ");
      pushToast({
        id: `order-${saleId}-${Date.now()}`,
        tone: "order",
        title: `ลูกค้าสั่งอาหาร • ${tableName}`,
        message: summary,
      });
      playChime("order");
    },
    [playChime, pushToast, resolveTableName]
  );

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel("staff-order-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sale_items", filter: "ordered_by=eq.customer" },
        (payload) => {
          const row = payload.new as { sale_id: string; product_name: string; quantity: number };
          let entry = pendingRef.current.get(row.sale_id);
          if (!entry) {
            entry = { saleId: row.sale_id, items: [], timer: null };
            pendingRef.current.set(row.sale_id, entry);
          }
          entry.items.push({ name: row.product_name, qty: Number(row.quantity) });
          if (entry.timer) clearTimeout(entry.timer);
          entry.timer = setTimeout(() => flushOrder(row.sale_id), BATCH_MS);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sales" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            status: string;
            bill_requested_at: string | null;
            table_id: string | null;
          };
          if (row.status !== "open" || !row.bill_requested_at) return;
          if (notifiedBillRef.current.has(row.id)) return;
          notifiedBillRef.current.add(row.id);
          const tableName = await resolveTableName(row.id);
          pushToast({
            id: `bill-${row.id}-${Date.now()}`,
            tone: "bill",
            title: `เรียกเก็บเงิน • ${tableName}`,
            message: "ลูกค้าพร้อมจ่ายแล้ว",
          });
          playChime("bill");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, supabase, flushOrder, playChime, pushToast, resolveTableName]);

  if (!profile) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur animate-toast-in ${
            t.tone === "bill"
              ? "border-amber-300 bg-amber-50/95"
              : "border-brand-300 bg-white/95"
          }`}
        >
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              t.tone === "bill" ? "bg-amber-500 text-white" : "bg-brand-600 text-white"
            }`}
          >
            {t.tone === "bill" ? (
              <Receipt className="h-4 w-4" strokeWidth={2} />
            ) : (
              <Bell className="h-4 w-4" strokeWidth={2} />
            )}
          </div>
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => router.push("/")}
          >
            <p className={`font-semibold ${t.tone === "bill" ? "text-amber-800" : "text-neutral-800"}`}>
              {t.title}
            </p>
            <p className="mt-0.5 break-words text-sm text-neutral-600">{t.message}</p>
          </button>
          <button
            className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-black/5"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
