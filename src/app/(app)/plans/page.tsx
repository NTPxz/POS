"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Lightbulb, Plus, RefreshCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import { BusinessPlan } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

export default function PlansPage() {
  return (
    <RequireRole min="owner">
      <PlansPageContent />
    </RequireRole>
  );
}

function PlansPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<BusinessPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("business_plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setItems((data as BusinessPlan[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("business-plans-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_plans" },
        () => loadData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadData]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    setAddError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("business_plans").insert({
      title: title.trim(),
      note: note.trim() || null,
      created_by: user?.id ?? null,
    });
    setAdding(false);
    if (error) {
      setAddError(`เพิ่มไม่สำเร็จ: ${error.message}`);
      return;
    }
    setTitle("");
    setNote("");
    loadData();
  }

  async function toggleDone(item: BusinessPlan) {
    setBusyId(item.id);
    const nextDone = !item.is_done;
    const { error } = await supabase
      .from("business_plans")
      .update({ is_done: nextDone, done_at: nextDone ? new Date().toISOString() : null })
      .eq("id", item.id);
    setBusyId(null);
    if (error) {
      window.alert(`บันทึกไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadData();
  }

  async function deleteItem(item: BusinessPlan) {
    if (!window.confirm(`ลบแผน "${item.title}" ออก?`)) return;
    setBusyId(item.id);
    const { error } = await supabase.from("business_plans").delete().eq("id", item.id);
    setBusyId(null);
    if (error) {
      window.alert(`ลบไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadData();
  }

  const pending = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <h1 className="mb-4 text-xl font-bold md:text-2xl">แผนพัฒนาร้าน</h1>

      <div className="mx-auto max-w-lg">
        <form onSubmit={addItem} className="card mb-5 space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="สิ่งที่วางแผนจะทำ เช่น เพิ่มเมนูย่าง"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoFocus
            />
            <input
              className="input"
              placeholder="รายละเอียด (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          {addError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{addError}</p>
          )}
          <button
            type="submit"
            className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5"
            disabled={adding}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {adding ? "กำลังเพิ่ม..." : "เพิ่มแผน"}
          </button>
        </form>

        {loading ? (
          <p className="py-10 text-center text-neutral-400">กำลังโหลด...</p>
        ) : loadError ? (
          <div className="py-10 text-center text-red-500">
            <AlertCircle className="mx-auto mb-2 h-8 w-8" strokeWidth={1.5} />
            <p className="mb-3 text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
            <button className="btn-secondary inline-flex items-center gap-2" onClick={loadData}>
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              ลองอีกครั้ง
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">
            <Lightbulb className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
            <p>ยังไม่มีแผนพัฒนาร้าน</p>
          </div>
        ) : (
          <div className="space-y-5">
            {pending.length > 0 && (
              <ul className="space-y-2">
                {pending.map((item) => (
                  <PlanRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onToggle={() => toggleDone(item)}
                    onDelete={() => deleteItem(item)}
                  />
                ))}
              </ul>
            )}

            {done.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">
                  ทำแล้ว ({done.length})
                </p>
                <ul className="space-y-2">
                  {done.map((item) => (
                    <PlanRow
                      key={item.id}
                      item={item}
                      busy={busyId === item.id}
                      onToggle={() => toggleDone(item)}
                      onDelete={() => deleteItem(item)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanRow({
  item,
  busy,
  onToggle,
  onDelete,
}: {
  item: BusinessPlan;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={`card flex items-start gap-3 p-3.5 ${item.is_done ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
        checked={item.is_done}
        disabled={busy}
        onChange={onToggle}
      />
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${item.is_done ? "text-neutral-400 line-through" : "text-neutral-900"}`}>
          {item.title}
        </p>
        {item.note && <p className="mt-0.5 text-sm text-neutral-500">{item.note}</p>}
        <p className="mt-1 text-xs text-neutral-400">
          {item.is_done && item.done_at
            ? `ทำเมื่อ ${formatDateTime(item.done_at)}`
            : `เพิ่มเมื่อ ${formatDateTime(item.created_at)}`}
        </p>
      </div>
      <button
        className="shrink-0 rounded-lg p-2 text-neutral-300 hover:bg-red-50 hover:text-red-500"
        onClick={onDelete}
        disabled={busy}
        aria-label="ลบแผน"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </button>
    </li>
  );
}
