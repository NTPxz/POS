"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Percent, Plus, RefreshCw, Tag, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht } from "@/lib/format";
import { Product, Promotion, PromotionType } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

type PromotionRow = Promotion & {
  promotion_products: { product_id: string }[];
};

const TYPE_LABELS: Record<PromotionType, string> = {
  buy_x_get_fixed_discount: "ครบ N ชิ้น ลดตายตัว X บาท",
};

function describePromotion(p: Promotion): string {
  if (p.type === "buy_x_get_fixed_discount") {
    return `สั่งเมนูที่เลือกไว้ครบทุก ${p.threshold_qty ?? "-"} ชิ้น (รวมทั้งบิลของโต๊ะ) ลดราคาอัตโนมัติ ${p.discount_amount ?? "-"} บาท — ครบกี่รอบคูณส่วนลดตามไปด้วย`;
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
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const productName = useCallback(
    (id: string) => products.find((p) => p.id === id)?.name ?? "?",
    [products]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [promoRes, prodRes] = await Promise.all([
        supabase
          .from("promotions")
          .select("*, promotion_products(product_id)")
          .order("created_at", { ascending: false }),
        supabase.from("products").select("*").eq("is_active", true).order("name"),
      ]);
      if (promoRes.error) throw promoRes.error;
      if (prodRes.error) throw prodRes.error;
      setPromotions((promoRes.data as PromotionRow[]) ?? []);
      setProducts((prodRes.data as Product[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: PromotionRow) {
    setEditing(p);
    setModalOpen(true);
  }

  async function toggleActive(p: PromotionRow, active: boolean) {
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

  async function handleDelete(p: PromotionRow) {
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
        <button className="btn-primary inline-flex items-center gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          เพิ่มโปรโมชั่น
        </button>
      </div>

      <div className="card mb-4 flex items-start gap-3 p-4 text-sm text-neutral-600">
        <Tag className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={2} />
        <p>
          เลือกเมนูที่เข้าร่วมโปรโมชั่นเองได้ — ระบบจะนับจำนวนเฉพาะเมนูที่เลือกไว้เท่านั้น
          (ไม่นับสินค้าอื่นในบิล) คำนวณส่วนลดอัตโนมัติทุกครั้งที่มีการสั่ง/แก้ไขออเดอร์ในโหมด &ldquo;เปิดโต๊ะ&rdquo;
          ทั้งพนักงานคีย์เองและลูกค้าสั่งผ่าน QR — ลูกค้าจะเห็นส่วนลดที่ได้ในหน้าสั่งอาหารของตัวเองด้วย
        </p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-neutral-400">กำลังโหลด...</p>
      ) : loadError ? (
        <div className="py-16 text-center text-red-500">
          <AlertCircle className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p className="mb-3 text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          <button className="btn-secondary inline-flex items-center gap-2" onClick={loadData}>
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
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.promotion_products.length === 0 ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">
                        ยังไม่ได้เลือกเมนู — จะไม่มีผลลด
                      </span>
                    ) : (
                      p.promotion_products.map((pp) => (
                        <span
                          key={pp.product_id}
                          className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                        >
                          {productName(pp.product_id)}
                        </span>
                      ))
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
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
                  <div className="flex gap-1">
                    <button
                      className="rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50"
                      onClick={() => openEdit(p)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="rounded-lg px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(p)}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <PromotionModal
          promotion={editing}
          products={products}
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
  promotion,
  products,
  onClose,
  onSaved,
}: {
  promotion: PromotionRow | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(promotion?.name ?? "");
  const [type, setType] = useState<PromotionType>(promotion?.type ?? "buy_x_get_fixed_discount");
  const [thresholdQty, setThresholdQty] = useState(
    promotion?.threshold_qty ? String(promotion.threshold_qty) : "10"
  );
  const [discountAmount, setDiscountAmount] = useState(
    promotion?.discount_amount ? String(promotion.discount_amount) : "10"
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(promotion?.promotion_products.map((pp) => pp.product_id) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    const amount = parseFloat(discountAmount);
    if (!amount || amount <= 0) {
      setError("กรอกจำนวนเงินส่วนลดให้ถูกต้อง");
      setSaving(false);
      return;
    }
    if (selectedIds.size === 0) {
      setError("เลือกอย่างน้อย 1 เมนูที่ให้เข้าร่วมโปรโมชั่นนี้");
      setSaving(false);
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      threshold_qty: qty,
      discount_amount: amount,
      is_active: true,
    };
    let promotionId = promotion?.id;

    if (promotionId) {
      const { error: updateErr } = await supabase
        .from("promotions")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", promotionId);
      if (updateErr) {
        setError(`บันทึกไม่สำเร็จ: ${updateErr.message}`);
        setSaving(false);
        return;
      }
      const { error: delErr } = await supabase
        .from("promotion_products")
        .delete()
        .eq("promotion_id", promotionId);
      if (delErr) {
        setError(`บันทึกรายการเมนูไม่สำเร็จ: ${delErr.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { data, error: insertErr } = await supabase
        .from("promotions")
        .insert(payload)
        .select("id")
        .single();
      if (insertErr || !data) {
        setError(`บันทึกไม่สำเร็จ: ${insertErr?.message}`);
        setSaving(false);
        return;
      }
      promotionId = data.id;
    }

    const { error: linkErr } = await supabase.from("promotion_products").insert(
      Array.from(selectedIds).map((product_id) => ({
        promotion_id: promotionId,
        product_id,
      }))
    );
    setSaving(false);
    if (linkErr) {
      setError(`บันทึกรายการเมนูไม่สำเร็จ: ${linkErr.message}`);
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
          <h2 className="text-xl font-bold">{promotion ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่น"}</h2>
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

          {type === "buy_x_get_fixed_discount" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="สั่งครบกี่ชิ้นต่อ 1 รอบส่วนลด *">
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
                <Field label="ลดกี่บาทต่อรอบ *">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className="input"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    required
                  />
                </Field>
              </div>

              <Field label={`เลือกเมนูที่เข้าร่วม * (เลือกแล้ว ${selectedIds.size} รายการ)`}>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
                  {products.length === 0 ? (
                    <p className="p-2 text-sm text-neutral-400">ยังไม่มีสินค้าในระบบ</p>
                  ) : (
                    products.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4.5 w-4.5 shrink-0 accent-brand-600"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleProduct(product.id)}
                          />
                          <span className="truncate text-sm">{product.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-neutral-400">
                          {baht(product.price)}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </Field>
            </>
          )}

          <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
            ระบบจะนับจำนวนเฉพาะเมนูที่เลือกไว้ด้านบนเท่านั้น แล้วลดราคาอัตโนมัติตามจำนวนเงินที่ตั้งไว้
            ทุกครั้งที่จำนวนชิ้นรวมครบตามที่ตั้งไว้ (ครบ 2 รอบ ลด 2 เท่า ฯลฯ)
          </p>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
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
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}
