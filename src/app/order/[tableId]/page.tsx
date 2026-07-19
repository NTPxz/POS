"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Percent,
  RefreshCw,
  ShoppingCart,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber } from "@/lib/format";
import {
  Category,
  DiningTable,
  Product,
  Promotion,
  SALE_ITEM_STATUS_LABELS,
  TableOrder,
} from "@/lib/types";
import ProductPicker from "@/components/pos/ProductPicker";

type RoundItem = { product: Product; quantity: number };

const POLL_MS = 12000;

export default function CustomerOrderPage({
  params,
}: {
  params: { tableId: string };
}) {
  const tableId = params.tableId;
  const supabase = useMemo(() => createClient(), []);

  const [table, setTable] = useState<DiningTable | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<
    (Promotion & { promotion_products: { product_id: string }[] })[]
  >([]);
  const [order, setOrder] = useState<TableOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [round, setRound] = useState<RoundItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    const { data } = await supabase.rpc("get_table_order", {
      p_table_id: tableId,
    });
    if (data) setOrder(data as TableOrder);
  }, [supabase, tableId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [tableRes, menuRes, catRes, promoRes] = await Promise.all([
        supabase
          .from("dining_tables")
          .select("*")
          .eq("id", tableId)
          .maybeSingle(),
        supabase.from("public_menu").select("*").order("name"),
        supabase.from("categories").select("*").order("position"),
        supabase
          .from("promotions")
          .select("*, promotion_products(product_id)")
          .eq("is_active", true),
      ]);
      if (tableRes.error) throw tableRes.error;
      if (menuRes.error) throw menuRes.error;
      if (catRes.error) throw catRes.error;
      setTable((tableRes.data as DiningTable) ?? null);
      setProducts((menuRes.data as Product[]) ?? []);
      setCategories((catRes.data as Category[]) ?? []);
      setPromotions(
        (promoRes.data as (Promotion & { promotion_products: { product_id: string }[] })[]) ?? []
      );
      await loadOrder();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, tableId, loadOrder]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // รีเฟรชออเดอร์เป็นระยะ เผื่อโต๊ะเดียวกันมีคนอื่นสั่งด้วย หรือพนักงานเก็บเงินไปแล้ว
  useEffect(() => {
    const interval = setInterval(loadOrder, POLL_MS);
    return () => clearInterval(interval);
  }, [loadOrder]);

  const roundTotal = round.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const roundCount = round.reduce((s, i) => s + i.quantity, 0);
  const existingTotal = order ? Number(order.subtotal) : 0;

  function addToRound(product: Product) {
    setRound((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setPanelOpen(true);
  }

  function changeQty(productId: string, delta: number) {
    setRound((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  async function submitRound() {
    if (round.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.rpc("customer_add_order", {
      p_table_id: tableId,
      p_items: round.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
      })),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(`สั่งอาหารไม่สำเร็จ: ${error.message}`);
      return;
    }
    setSubmittedMsg("ส่งออเดอร์เรียบร้อยแล้ว! กำลังจัดเตรียมให้ค่ะ");
    setRound([]);
    setPanelOpen(false);
    await loadOrder();
    setTimeout(() => setSubmittedMsg(null), 4000);
  }

  async function requestBill() {
    setRequesting(true);
    setRequestError(null);
    const { error } = await supabase.rpc("request_checkout", {
      p_table_id: tableId,
    });
    setRequesting(false);
    if (error) {
      setRequestError(`เรียกเก็บเงินไม่สำเร็จ: ${error.message}`);
      return;
    }
    await loadOrder();
  }

  if (loading) {
    return (
      <CenterMessage>
        <p className="text-neutral-400">กำลังโหลดเมนู...</p>
      </CenterMessage>
    );
  }

  if (loadError) {
    return (
      <CenterMessage>
        <AlertCircle className="mx-auto mb-2 h-10 w-10 text-red-500" strokeWidth={1.5} />
        <p className="mb-3 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
        <button className="btn-secondary inline-flex items-center gap-2" onClick={loadAll}>
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
          ลองอีกครั้ง
        </button>
      </CenterMessage>
    );
  }

  if (!table) {
    return (
      <CenterMessage>
        <AlertCircle className="mx-auto mb-2 h-10 w-10 text-neutral-400" strokeWidth={1.5} />
        <p className="text-neutral-500">ไม่พบโต๊ะนี้ กรุณาสแกน QR ใหม่อีกครั้ง</p>
      </CenterMessage>
    );
  }

  if (!table.is_active) {
    return (
      <CenterMessage>
        <AlertCircle className="mx-auto mb-2 h-10 w-10 text-neutral-400" strokeWidth={1.5} />
        <p className="text-neutral-500">โต๊ะนี้ไม่พร้อมใช้งาน กรุณาติดต่อพนักงาน</p>
      </CenterMessage>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
          <Image src="/logo.png" alt="โลโก้ร้าน" width={36} height={36} className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="font-bold leading-tight">{table.name}</p>
          <p className="text-xs text-neutral-500">สแกนสั่งอาหารด้วยตัวเอง</p>
        </div>
      </header>

      {promotions.length > 0 && (
        <div className="mx-4 mt-3 space-y-2">
          {promotions.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white shadow"
            >
              <Percent className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{p.name}</p>
                {p.type === "buy_x_get_fixed_discount" && (
                  <>
                    <p className="mt-0.5 text-xs text-brand-50">
                      สั่งครบทุก {p.threshold_qty} ชิ้น รับส่วนลด {p.discount_amount} บาท อัตโนมัติ
                    </p>
                    <p className="mt-1 text-xs text-brand-50/90">
                      ใช้ได้กับ:{" "}
                      {p.promotion_products
                        .map(
                          (pp) =>
                            products.find((prod) => prod.id === pp.product_id)?.name ?? "เมนูนี้"
                        )
                        .join(", ")}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {submittedMsg && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
          {submittedMsg}
        </div>
      )}

      {order?.bill_requested && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Bell className="h-4 w-4 shrink-0" strokeWidth={2} />
          แจ้งพนักงานแล้ว เดี๋ยวพนักงานจะมาเก็บเงินนะคะ/ครับ
        </div>
      )}

      <div className="flex flex-1 flex-col pb-24">
        <ProductPicker products={products} categories={categories} onAdd={addToRound} />
      </div>

      {/* ปุ่มลอยดูออเดอร์ */}
      {!panelOpen && (roundCount > 0 || (order && order.items.length > 0)) && (
        <button
          onClick={() => setPanelOpen(true)}
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-white shadow-xl active:scale-[0.98]"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-5 w-5" strokeWidth={2} />
            {roundCount > 0 ? `+${formatNumber(roundCount)} รายการใหม่` : "ดูออเดอร์ของฉัน"}
          </span>
          <span className="text-lg font-bold">
            {baht(Math.max(existingTotal + roundTotal - (order ? Number(order.discount) : 0), 0))}
          </span>
        </button>
      )}

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
          <div className="absolute inset-0" onClick={() => setPanelOpen(false)} />
          <div className="relative flex max-h-[85dvh] flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="text-lg font-bold">ออเดอร์ของฉัน · {table.name}</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {order && order.items.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">
                    สั่งไปแล้ว
                  </p>
                  <ul className="space-y-1.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-neutral-600">
                          {item.product_name} × {formatNumber(Number(item.quantity))}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.status === "served"
                                ? "bg-green-50 text-green-600"
                                : item.status === "accepted"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {SALE_ITEM_STATUS_LABELS[item.status]}
                          </span>
                          <span className="font-medium">{baht(Number(item.total))}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">
                รอบนี้ (ยังไม่ส่ง)
              </p>
              {round.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">
                  แตะสินค้าเพื่อสั่งเพิ่ม
                </p>
              ) : (
                <ul className="space-y-2">
                  {round.map((item) => (
                    <li
                      key={item.product.id}
                      className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.product.name}</p>
                        <p className="text-xs text-neutral-500">
                          {baht(item.product.price)} × {formatNumber(item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => changeQty(item.product.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600 active:scale-95"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {formatNumber(item.quantity)}
                        </span>
                        <button
                          onClick={() => changeQty(item.product.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600 active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {submitError && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                  {submitError}
                </p>
              )}
              {requestError && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                  {requestError}
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-neutral-200 p-4">
              {round.length > 0 && (
                <button
                  className="btn-primary w-full py-3"
                  disabled={submitting}
                  onClick={submitRound}
                >
                  {submitting ? "กำลังส่ง..." : `สั่งอาหาร (+${baht(roundTotal)})`}
                </button>
              )}
              {order && Number(order.discount) > 0 && (
                <div className="flex items-center justify-between px-1 text-sm text-green-600">
                  <span>🎉 ส่วนลดโปรโมชั่นที่ได้รับ</span>
                  <span className="font-semibold">-{baht(Number(order.discount))}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-1">
                <span className="text-neutral-500">ยอดรวมทั้งหมด</span>
                <span className="text-2xl font-bold">
                  {baht(
                    Math.max(existingTotal + roundTotal - (order ? Number(order.discount) : 0), 0)
                  )}
                </span>
              </div>
              <button
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 py-3"
                disabled={
                  requesting || !order || order.items.length === 0 || order.bill_requested
                }
                onClick={requestBill}
              >
                <Bell className="h-4 w-4" strokeWidth={2} />
                {order?.bill_requested
                  ? "แจ้งพนักงานแล้ว"
                  : requesting
                    ? "กำลังแจ้ง..."
                    : "เรียกเก็บเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-100 p-6 text-center">
      {children}
    </div>
  );
}
