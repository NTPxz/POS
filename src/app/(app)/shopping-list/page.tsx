"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, RefreshCw, ShoppingBasket, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ShoppingListItem } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

export default function ShoppingListPage() {
  return (
    <RequireRole min="staff">
      <ShoppingListPageContent />
    </RequireRole>
  );
}

function ShoppingListPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setItems((data as ShoppingListItem[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // เห็นรายการเปลี่ยนแบบเรียลไทม์ เผื่อพนักงาน/เจ้าของร้านคนอื่นเพิ่ม/เช็คพร้อมกัน
  useEffect(() => {
    const channel = supabase
      .channel("shopping-list-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_list_items" },
        () => loadData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadData]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setAddError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("shopping_list_items").insert({
      name: name.trim(),
      note: note.trim() || null,
      created_by: user?.id ?? null,
    });
    setAdding(false);
    if (error) {
      setAddError(`เพิ่มไม่สำเร็จ: ${error.message}`);
      return;
    }
    setName("");
    setNote("");
    loadData();
  }

  async function toggleChecked(item: ShoppingListItem) {
    setBusyId(item.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nextChecked = !item.is_checked;
    const { error } = await supabase
      .from("shopping_list_items")
      .update(
        nextChecked
          ? { is_checked: true, checked_by: user?.id ?? null, checked_at: new Date().toISOString() }
          : { is_checked: false, checked_by: null, checked_at: null }
      )
      .eq("id", item.id);
    setBusyId(null);
    if (error) {
      window.alert(`บันทึกไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadData();
  }

  async function deleteItem(item: ShoppingListItem) {
    if (!window.confirm(`ลบ "${item.name}" ออกจากรายการ?`)) return;
    setBusyId(item.id);
    const { error } = await supabase.from("shopping_list_items").delete().eq("id", item.id);
    setBusyId(null);
    if (error) {
      window.alert(`ลบไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadData();
  }

  async function clearChecked() {
    if (!window.confirm("ล้างรายการที่ซื้อแล้วทั้งหมดออกจากลิสต์?")) return;
    const { error } = await supabase.from("shopping_list_items").delete().eq("is_checked", true);
    if (error) {
      window.alert(`ล้างไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadData();
  }

  const pending = items.filter((i) => !i.is_checked);
  const checked = items.filter((i) => i.is_checked);

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <h1 className="mb-4 text-xl font-bold md:text-2xl">ของที่ต้องซื้อ</h1>

      <div className="mx-auto max-w-lg">
        <form onSubmit={addItem} className="card mb-5 space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="ชื่อของที่ต้องซื้อ เช่น น้ำมันพืช"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
              autoFocus
            />
            <input
              className="input"
              placeholder="หมายเหตุ เช่น 2 ขวด (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
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
            {adding ? "กำลังเพิ่ม..." : "เพิ่มรายการ"}
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
            <ShoppingBasket className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
            <p>ยังไม่มีรายการของที่ต้องซื้อ</p>
          </div>
        ) : (
          <div className="space-y-5">
            {pending.length > 0 && (
              <ul className="space-y-2">
                {pending.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onToggle={() => toggleChecked(item)}
                    onDelete={() => deleteItem(item)}
                  />
                ))}
              </ul>
            )}

            {checked.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-neutral-400">
                    ซื้อแล้ว ({checked.length})
                  </p>
                  <button
                    className="text-xs font-medium text-red-500 hover:underline"
                    onClick={clearChecked}
                  >
                    ล้างรายการที่ซื้อแล้ว
                  </button>
                </div>
                <ul className="space-y-2">
                  {checked.map((item) => (
                    <ShoppingRow
                      key={item.id}
                      item={item}
                      busy={busyId === item.id}
                      onToggle={() => toggleChecked(item)}
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

function ShoppingRow({
  item,
  busy,
  onToggle,
  onDelete,
}: {
  item: ShoppingListItem;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={`card flex items-center gap-3 p-3.5 ${item.is_checked ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 accent-brand-600"
        checked={item.is_checked}
        disabled={busy}
        onChange={onToggle}
      />
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${item.is_checked ? "text-neutral-400 line-through" : "text-neutral-900"}`}>
          {item.name}
        </p>
        {item.note && (
          <p className="truncate text-xs text-neutral-400">{item.note}</p>
        )}
      </div>
      <button
        className="shrink-0 rounded-lg p-2 text-neutral-300 hover:bg-red-50 hover:text-red-500"
        onClick={onDelete}
        disabled={busy}
        aria-label="ลบรายการ"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </button>
    </li>
  );
}
