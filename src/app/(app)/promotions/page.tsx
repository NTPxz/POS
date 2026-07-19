"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Percent, Plus, RefreshCw, Tag, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Promotion, PromotionType } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

const TYPE_LABELS: Record<PromotionType, string> = {
  buy_x_get_cheapest_free: "ครบ N ชิ้น ลดเท่าเมนูถูกสุด (เหมือนแถม 1)",
};

function describePromotion(p: Promotion): string {
  if (p.type === "buy_x_get_cheapest_free") {
    return `สั่งครบทุก ${p.threshold_qty ?? "-"} ชิ้น (รวมทั้งบิลของโต๊ะ) ลดราคาอัตโนมัติเท่ากับเมนูที่ถูกที่สุดในบิล — ครบกี่รอบคูณส่วนลดตามไปด้วย`;
  }
  return "";
}

export default function PromotionsPage() {
  return (
    <RequireRole min="owner">
      <PromotionsPageContent />
    </RequireRole>
  );
}

function PromotionsPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPromotions((data as Promotion[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleActive(p: Promotion, active: boolean) {
    setSavingId(p.id);
    setPromotions((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, is_active: active } : item))
    );
    const { error } = await supabase
      .from("promotions")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setSavingId(null);
    if (error) {
      window.alert(`บันทึกไม่สำเร็จ: ${error.message}`);
      loadData();
    }
  }

  async function handleDelete(p: Promotion) {
    if (!window.confirm(`ลบโปรโมชั่น "${p.name}" ?`)) return;
    const { error } = await supabase.from("promotions").delete().eq("id", p.id);
    if (error) {
      window.alert(`ลบไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadData();
  }

  return (
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">จัดการโปรโมชั่น</h1>
        <button
          className="btn-primary inline-flex items-center gap-2"
          onClick={() => setModalOpen(true)}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          เพิ่มโปรโมชั่น
        </button>
      </div>

      <div className="card mb-4 flex items-start gap-3 p-4 text-sm text-neutral-600">
        <Tag className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={2} />
        <p>
          โปรโมชั่นที่เปิดใช้งานจะคำนวณส่วนลดให้อัตโนมัติทุกครั้งที่มีการสั่ง/แก้ไขออเดอร์ในโหมด &ldquo;เปิดโต๊ะ&rdquo;
          (ทั้งพนักงานคีย์เองและลูกค้าสั่งผ่าน QR) — ลูกค้าจะเห็นส่วนลดที่ได้ในหน้าสั่งอาหารของตัวเองด้วย
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
            onClick={loadData}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      ) : promotions.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Percent className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>ยังไม่มีโปรโมชั่น — กด &ldquo;เพิ่มโปรโมชั่น&rdquo; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {promotions.map((p) => (
            <li key={p.id} className={`card p-4 ${!p.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {p.name}
                    {!p.is_active && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                        ปิดใช้งาน
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">{TYPE_LABELS[p.type]}</p>
                  <p className="mt-1.5 text-sm text-neutral-600">{describePromotion(p)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-neutral-600">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand-600"
                      checked={p.is_active}
                      disabled={savingId === p.id}
                      onChange={(e) => toggleActive(p, e.target.checked)}
                    />
                    เปิดใช้งาน
                  </label>
                  <button
                    className="rounded-lg px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
                    onClick={() => handleDelete(p)}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <PromotionModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function PromotionModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [type, setType] = useState<PromotionType>("buy_x_get_cheapest_free");
  const [thresholdQty, setThresholdQty] = useState("10");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const qty = parseInt(thresholdQty, 10);
    if (!qty || qty <= 0) {
      setError("กรอกจำนวนชิ้นให้ถูกต้อง");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("promotions").insert({
      name: name.trim(),
      type,
      threshold_qty: qty,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      setError(`บันทึกไม่สำเร็จ: ${error.message}`);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <form
        onSubmit={save}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">เพิ่มโปรโมชั่น</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <Field label="ชื่อโปรโมชั่น *">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น สั่งครบ 10 แถม 1"
              required
              autoFocus
              maxLength={100}
            />
          </Field>

          <Field label="ประเภทโปรโมชั่น">
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as PromotionType)}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          {type === "buy_x_get_cheapest_free" && (
            <Field label="สั่งครบกี่ชิ้น (รวมทั้งบิลของโต๊ะ) ต่อ 1 รอบส่วนลด *">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="input"
                value={thresholdQty}
                onChange={(e) => setThresholdQty(e.target.value)}
                required
              />
            </Field>
          )}

          <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
            ระบบจะลดราคาอัตโนมัติเท่ากับราคาเมนูที่ถูกที่สุดในบิลนั้น ทุกครั้งที่จำนวนชิ้นรวมครบตามที่ตั้งไว้
            (ครบ 2 รอบ ลด 2 เท่า ฯลฯ)
          </p>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-neutral-200 p-4 px-6">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
    </div>
  );
}
