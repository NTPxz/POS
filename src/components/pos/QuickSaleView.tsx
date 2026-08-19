"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber } from "@/lib/format";
import {
  Category,
  hasRole,
  PaymentMethod,
  Product,
  QuickSaleQueue,
  SaleItem,
  SaleWithItems,
} from "@/lib/types";
import ProductPicker from "@/components/pos/ProductPicker";
import PaymentFields from "@/components/pos/PaymentFields";
import { useProfile } from "@/components/ProfileProvider";

export default function QuickSaleView({
  products,
  categories,
  onSaleDone,
}: {
  products: Product[];
  categories: Category[];
  onSaleDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const isManagerUp = !!profile && hasRole(profile.role, "manager");
  const [queues, setQueues] = useState<QuickSaleQueue[]>([]);
  const [openSales, setOpenSales] = useState<Map<string, SaleWithItems>>(new Map());
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [salesRank, setSalesRank] = useState<Map<string, number>>(new Map());
  const [creatorNames, setCreatorNames] = useState<Map<string, string>>(new Map());
  const [successInfo, setSuccessInfo] = useState<{
    total: number;
    received: number | null;
    change: number | null;
  } | null>(null);

  // โหลดคิว + บิล "open" ของแต่ละคิว — เก็บลง DB จริงกันตะกร้าหายตอนปิด/ปัดแอปออก
  const loadQueues = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [queuesRes, salesRes] = await Promise.all([
        supabase.from("quick_sale_queues").select("*").order("position"),
        supabase
          .from("sales")
          .select("*, sale_items(*)")
          .eq("status", "open")
          .not("queue_id", "is", null)
          .order("created_at", { ascending: true, foreignTable: "sale_items" }),
      ]);
      if (queuesRes.error) throw queuesRes.error;
      if (salesRes.error) throw salesRes.error;
      const nextQueues = (queuesRes.data as QuickSaleQueue[]) ?? [];
      setQueues(nextQueues);
      const map = new Map<string, SaleWithItems>();
      for (const s of (salesRes.data as SaleWithItems[]) ?? []) {
        if (s.queue_id) map.set(s.queue_id, s);
      }
      setOpenSales(map);
      setActiveQueueId((prev) =>
        prev && nextQueues.some((q) => q.id === prev) ? prev : (nextQueues[0]?.id ?? null)
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  // เรียลไทม์: กันข้อมูลเพี้ยนถ้ามีคนแก้คิวเดียวกันจากอีกเครื่อง
  useEffect(() => {
    const channel = supabase
      .channel("quick-sale-queues-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () =>
        loadQueues(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quick_sale_queues" },
        () => loadQueues(true)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadQueues]);

  // ชื่อคนกดเพิ่มแต่ละรายการ — เห็นเฉพาะผู้จัดการขึ้นไป (RLS ของ profiles จำกัดพนักงานทั่วไป
  // ให้อ่านได้แค่โปรไฟล์ตัวเอง) ใช้แสดงป้าย "โดย ..." ในตะกร้าเวลาบิลถูกใช้ร่วมกันหลายคน
  useEffect(() => {
    if (!isManagerUp) {
      setCreatorNames(new Map());
      return;
    }
    const ids = new Set<string>();
    for (const sale of openSales.values()) {
      for (const item of sale.sale_items) {
        if (item.created_by) ids.add(item.created_by);
      }
    }
    if (ids.size === 0) {
      setCreatorNames(new Map());
      return;
    }
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", [...ids])
      .then(({ data }) => {
        const map = new Map<string, string>();
        for (const p of (data as { id: string; full_name: string | null; phone: string | null }[]) ?? []) {
          map.set(p.id, p.full_name || p.phone || "พนักงาน");
        }
        setCreatorNames(map);
      });
  }, [supabase, openSales, isManagerUp]);

  useEffect(() => {
    supabase
      .rpc("get_product_sales_counts", { p_days: 30 })
      .then(({ data }) => {
        const map = new Map<string, number>();
        for (const row of (data as { product_id: string; qty: number }[]) ?? []) {
          map.set(row.product_id, Number(row.qty));
        }
        setSalesRank(map);
      });
  }, [supabase]);

  // สินค้าขายดี (ขายเยอะสุดใน 30 วันล่าสุด) อยู่บนสุด — ที่เหลือเรียงตามลำดับเดิม
  const sortedProducts = useMemo(() => {
    if (salesRank.size === 0) return products;
    return [...products].sort(
      (a, b) => (salesRank.get(b.id) ?? 0) - (salesRank.get(a.id) ?? 0)
    );
  }, [products, salesRank]);

  const activeSale = activeQueueId ? (openSales.get(activeQueueId) ?? null) : null;
  const cartItems = useMemo(() => activeSale?.sale_items ?? [], [activeSale]);
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      if (item.product_id) map.set(item.product_id, Number(item.quantity));
    }
    return map;
  }, [cartItems]);
  const itemCount = cartItems.reduce((s, i) => s + Number(i.quantity), 0);
  const subtotal = cartItems.reduce((s, i) => s + Number(i.total), 0);

  async function addToCart(product: Product) {
    if (!activeQueueId) return;
    const { error } = await supabase.rpc("add_quick_sale_item", {
      p_queue_id: activeQueueId,
      p_product_id: product.id,
    });
    if (error) {
      window.alert(`เพิ่มสินค้าไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadQueues(true);
  }

  async function changeQty(item: SaleItem, delta: number) {
    const { error } = await supabase.rpc("set_quick_sale_item_quantity", {
      p_sale_item_id: item.id,
      p_quantity: Number(item.quantity) + delta,
    });
    if (error) {
      window.alert(`แก้ไขรายการไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadQueues(true);
  }

  async function removeItem(item: SaleItem) {
    const { error } = await supabase.rpc("set_quick_sale_item_quantity", {
      p_sale_item_id: item.id,
      p_quantity: 0,
    });
    if (error) {
      window.alert(`ลบรายการไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadQueues(true);
  }

  async function clearCart() {
    if (!activeQueueId) return;
    const { error } = await supabase.rpc("clear_quick_sale_queue", {
      p_queue_id: activeQueueId,
    });
    if (error) {
      window.alert(`ล้างตะกร้าไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadQueues(true);
  }

  async function renameQueue(queueId: string, name: string) {
    const { error } = await supabase
      .from("quick_sale_queues")
      .update({ name })
      .eq("id", queueId);
    if (error) {
      window.alert(`เปลี่ยนชื่อคิวไม่สำเร็จ: ${error.message}`);
      return;
    }
    loadQueues(true);
  }

  function handleCheckoutDone(info: {
    total: number;
    received: number | null;
    change: number | null;
  }) {
    setCheckoutOpen(false);
    setCartOpen(false);
    setSuccessInfo(info);
    loadQueues(true);
    onSaleDone();
  }

  const cartPanel = (
    <CartPanel
      items={cartItems}
      subtotal={subtotal}
      creatorNames={creatorNames}
      onChangeQty={changeQty}
      onRemove={removeItem}
      onCheckout={() => setCheckoutOpen(true)}
      onClear={clearCart}
    />
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-neutral-400">กำลังโหลดคิว...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center text-red-500">
        <AlertCircle className="h-10 w-10" strokeWidth={1.5} />
        <p className="text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
        <button
          className="btn-secondary inline-flex items-center gap-2"
          onClick={() => loadQueues()}
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="flex flex-1 flex-col">
        <QueueTabs
          queues={queues}
          openSales={openSales}
          activeQueueId={activeQueueId}
          onSelect={setActiveQueueId}
          onRename={renameQueue}
        />
        <ProductPicker
          products={sortedProducts}
          categories={categories}
          onAdd={addToCart}
          layout="row"
          quantities={cartQuantities}
        />
      </div>

      {/* ตะกร้า: จอใหญ่แสดงเป็น panel ขวา */}
      <div className="hidden w-96 shrink-0 border-l border-neutral-200 bg-white lg:flex lg:flex-col">
        {cartPanel}
      </div>

      {/* มือถือ/แท็บเล็ตแนวตั้ง: ปุ่มลอย + sheet */}
      {itemCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-20 z-40 flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-white shadow-xl active:scale-[0.98] md:bottom-4 md:left-60 lg:hidden"
        >
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm">
              {formatNumber(itemCount)}
            </span>
            ดูตะกร้า
          </span>
          <span className="text-lg font-bold">{baht(subtotal)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 lg:hidden">
          <div className="absolute inset-0" onClick={() => setCartOpen(false)} />
          <div className="relative flex max-h-[85dvh] flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="text-lg font-bold">ตะกร้าสินค้า</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            {cartPanel}
          </div>
        </div>
      )}

      {checkoutOpen && activeSale && (
        <CheckoutModal
          sale={activeSale}
          onClose={() => setCheckoutOpen(false)}
          onDone={handleCheckoutDone}
        />
      )}

      {successInfo && (
        <SuccessModal info={successInfo} onClose={() => setSuccessInfo(null)} />
      )}
    </div>
  );
}

function QueueTabs({
  queues,
  openSales,
  activeQueueId,
  onSelect,
  onRename,
}: {
  queues: QuickSaleQueue[];
  openSales: Map<string, SaleWithItems>;
  activeQueueId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-2.5">
      {queues.map((q) => {
        const count = (openSales.get(q.id)?.sale_items ?? []).reduce(
          (s, i) => s + Number(i.quantity),
          0
        );
        const active = q.id === activeQueueId;
        const editing = editingId === q.id;

        if (editing) {
          return (
            <input
              key={q.id}
              autoFocus
              defaultValue={q.name}
              maxLength={30}
              className="input w-28 shrink-0 py-2 text-sm"
              onBlur={(e) => {
                setEditingId(null);
                const name = e.target.value.trim();
                if (name && name !== q.name) onRename(q.id, name);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          );
        }

        return (
          <div
            key={q.id}
            className={`relative flex shrink-0 items-center rounded-full transition ${
              active
                ? "bg-brand-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            <button
              onClick={() => onSelect(q.id)}
              className="py-2 pl-4 pr-2 text-sm font-semibold"
            >
              {q.name}
            </button>
            {active && (
              <button
                onClick={() => setEditingId(q.id)}
                className="mr-2 rounded-full p-1 hover:bg-white/20"
                aria-label="แก้ไขชื่อคิว"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
            {count > 0 && (
              <span
                className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                  active ? "bg-white text-brand-700" : "bg-brand-600 text-white"
                }`}
              >
                {formatNumber(count)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CartPanel({
  items,
  subtotal,
  creatorNames,
  onChangeQty,
  onRemove,
  onCheckout,
  onClear,
}: {
  items: SaleItem[];
  subtotal: number;
  creatorNames: Map<string, string>;
  onChangeQty: (item: SaleItem, delta: number) => void;
  onRemove: (item: SaleItem) => void;
  onCheckout: () => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="hidden items-center justify-between px-5 pt-5 lg:flex">
        <h2 className="text-lg font-bold">ตะกร้าสินค้า</h2>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-neutral-400 hover:text-red-500"
          >
            ล้างตะกร้า
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">
            <ShoppingCart className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">แตะสินค้าเพื่อเพิ่มลงตะกร้า</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.product_name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {baht(Number(item.price))} × {formatNumber(Number(item.quantity))} ={" "}
                    <span className="font-semibold text-neutral-700">
                      {baht(Number(item.total))}
                    </span>
                  </p>
                  {item.created_by && creatorNames.get(item.created_by) && (
                    <p className="text-xs text-neutral-400">
                      โดย {creatorNames.get(item.created_by)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <QtyButton onClick={() => onChangeQty(item, -1)}>
                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                  </QtyButton>
                  <span className="w-8 text-center font-semibold">
                    {formatNumber(Number(item.quantity))}
                  </span>
                  <QtyButton onClick={() => onChangeQty(item, 1)}>
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </QtyButton>
                  <button
                    onClick={() => onRemove(item)}
                    className="ml-1 p-1 text-neutral-300 hover:text-red-500"
                    aria-label="ลบรายการ"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-neutral-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-neutral-500">
            รวม {formatNumber(items.reduce((s, i) => s + Number(i.quantity), 0))} ชิ้น
          </span>
          <span className="text-2xl font-bold">{baht(subtotal)}</span>
        </div>
        <button
          className="btn-primary w-full py-3.5 text-lg"
          disabled={items.length === 0}
          onClick={onCheckout}
        >
          คิดเงิน
        </button>
      </div>
    </>
  );
}

function QtyButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition active:scale-95 hover:bg-neutral-200"
    >
      {children}
    </button>
  );
}

function CheckoutModal({
  sale,
  onClose,
  onDone,
}: {
  sale: SaleWithItems;
  onClose: () => void;
  onDone: (info: {
    total: number;
    received: number | null;
    change: number | null;
  }) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [discountStr, setDiscountStr] = useState(() =>
    Number(sale.discount) > 0 ? String(Number(sale.discount)) : ""
  );
  const [receivedStr, setReceivedStr] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = Number(sale.subtotal);
  const discount = Math.max(parseFloat(discountStr) || 0, 0);
  const total = Math.max(subtotal - discount, 0);
  const received = parseFloat(receivedStr) || 0;
  const cashInsufficient = method === "cash" && received < total;

  async function confirm() {
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("checkout_quick_sale_queue", {
      p_sale_id: sale.id,
      p_discount: discount,
      p_payment_method: method,
      p_received: method === "cash" ? received : null,
      p_note: note.trim() || null,
    });
    if (error) {
      setError(`บันทึกการขายไม่สำเร็จ: ${error.message}`);
      setSaving(false);
      return;
    }
    onDone({
      total,
      received: method === "cash" ? received : null,
      change: method === "cash" ? Math.max(received - total, 0) : null,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">คิดเงิน</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="rounded-2xl bg-neutral-50 p-4">
            <ul className="mb-2 space-y-1 text-sm text-neutral-600">
              {sale.sale_items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>
                    {item.product_name} × {formatNumber(Number(item.quantity))}
                  </span>
                  <span>{baht(Number(item.total))}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-neutral-200 pt-2 text-sm text-neutral-500">
              <span>ยอดรวม</span>
              <span>{baht(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <label className="text-sm text-neutral-500">
                ส่วนลด (บาท){" "}
                {Number(sale.discount) > 0 && (
                  <span className="text-xs text-green-600">(รวมโปรโมชั่นแล้ว แก้ได้)</span>
                )}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                className="input w-32 py-1.5 text-right"
                placeholder="0"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
              />
            </div>
            <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3">
              <span className="font-semibold">ยอดสุทธิ</span>
              <span className="text-2xl font-bold text-brand-600">
                {baht(total)}
              </span>
            </div>
          </div>

          <PaymentFields
            total={total}
            method={method}
            onMethodChange={setMethod}
            receivedStr={receivedStr}
            onReceivedChange={setReceivedStr}
          />

          <div>
            <input
              className="input"
              placeholder="หมายเหตุ (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-neutral-200 p-4 px-6">
          <button
            className="btn-primary w-full py-3.5 text-lg"
            disabled={saving || cashInsufficient}
            onClick={confirm}
          >
            {saving ? "กำลังบันทึก..." : `ยืนยันการขาย ${baht(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({
  info,
  onClose,
}: {
  info: { total: number; received: number | null; change: number | null };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
        </div>
        <h2 className="text-xl font-bold">ขายสำเร็จ!</h2>
        <p className="mt-2 text-3xl font-bold text-brand-600">
          {baht(info.total)}
        </p>
        {info.change !== null && (
          <div className="mt-4 rounded-2xl bg-green-50 p-4">
            <p className="text-sm text-green-600">เงินทอน</p>
            <p className="text-3xl font-bold text-green-700">
              {baht(info.change)}
            </p>
          </div>
        )}
        <button className="btn-primary mt-6 w-full py-3" onClick={onClose}>
          ขายรายการต่อไป
        </button>
      </div>
    </div>
  );
}
