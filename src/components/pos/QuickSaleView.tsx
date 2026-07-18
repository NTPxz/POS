"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber } from "@/lib/format";
import { CartItem, Category, PaymentMethod, Product } from "@/lib/types";
import ProductPicker from "@/components/pos/ProductPicker";
import PaymentFields from "@/components/pos/PaymentFields";

export default function QuickSaleView({
  products,
  categories,
  onSaleDone,
}: {
  products: Product[];
  categories: Category[];
  onSaleDone: () => void;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    total: number;
    received: number | null;
    change: number | null;
  } | null>(null);

  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function handleCheckoutDone(info: {
    total: number;
    received: number | null;
    change: number | null;
  }) {
    setCheckoutOpen(false);
    setCartOpen(false);
    setCart([]);
    setSuccessInfo(info);
    onSaleDone();
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      subtotal={subtotal}
      onChangeQty={changeQty}
      onRemove={removeItem}
      onCheckout={() => setCheckoutOpen(true)}
      onClear={() => setCart([])}
    />
  );

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <ProductPicker products={products} categories={categories} onAdd={addToCart} />

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

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          subtotal={subtotal}
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

function CartPanel({
  cart,
  subtotal,
  onChangeQty,
  onRemove,
  onCheckout,
  onClear,
}: {
  cart: CartItem[];
  subtotal: number;
  onChangeQty: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="hidden items-center justify-between px-5 pt-5 lg:flex">
        <h2 className="text-lg font-bold">ตะกร้าสินค้า</h2>
        {cart.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-neutral-400 hover:text-red-500"
          >
            ล้างตะกร้า
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">
            <ShoppingCart className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">แตะสินค้าเพื่อเพิ่มลงตะกร้า</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {cart.map((item) => (
              <li
                key={item.product.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.product.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {baht(item.product.price)} × {formatNumber(item.quantity)} ={" "}
                    <span className="font-semibold text-neutral-700">
                      {baht(item.product.price * item.quantity)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <QtyButton onClick={() => onChangeQty(item.product.id, -1)}>
                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                  </QtyButton>
                  <span className="w-8 text-center font-semibold">
                    {formatNumber(item.quantity)}
                  </span>
                  <QtyButton onClick={() => onChangeQty(item.product.id, 1)}>
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </QtyButton>
                  <button
                    onClick={() => onRemove(item.product.id)}
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
            รวม {formatNumber(cart.reduce((s, i) => s + i.quantity, 0))} ชิ้น
          </span>
          <span className="text-2xl font-bold">{baht(subtotal)}</span>
        </div>
        <button
          className="btn-primary w-full py-3.5 text-lg"
          disabled={cart.length === 0}
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
  cart,
  subtotal,
  onClose,
  onDone,
}: {
  cart: CartItem[];
  subtotal: number;
  onClose: () => void;
  onDone: (info: {
    total: number;
    received: number | null;
    change: number | null;
  }) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [discountStr, setDiscountStr] = useState("");
  const [receivedStr, setReceivedStr] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discount = Math.max(parseFloat(discountStr) || 0, 0);
  const total = Math.max(subtotal - discount, 0);
  const received = parseFloat(receivedStr) || 0;
  const cashInsufficient = method === "cash" && received < total;

  async function confirm() {
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("create_sale", {
      p_items: cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
      })),
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
            <div className="flex justify-between text-sm text-neutral-500">
              <span>ยอดรวม ({cart.reduce((s, i) => s + i.quantity, 0)} ชิ้น)</span>
              <span>{baht(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <label className="text-sm text-neutral-500">ส่วนลด (บาท)</label>
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
