"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Plus,
  QrCode,
  RefreshCw,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatDateTime, formatNumber } from "@/lib/format";
import {
  Category,
  DiningTable,
  PaymentMethod,
  Product,
  SALE_ITEM_STATUS_LABELS,
  SaleItemStatus,
  SaleWithItems,
} from "@/lib/types";
import { useProfile } from "@/components/ProfileProvider";
import ProductPicker from "@/components/pos/ProductPicker";
import PaymentFields from "@/components/pos/PaymentFields";

type RoundItem = { product: Product; quantity: number };

export default function TablesView({
  products,
  categories,
  onProductsChanged,
}: {
  products: Product[];
  categories: Category[];
  onProductsChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const isOwner = profile?.role === "owner";

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [openSales, setOpenSales] = useState<Map<string, SaleWithItems>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const loadTables = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [tablesRes, salesRes] = await Promise.all([
        supabase
          .from("dining_tables")
          .select("*")
          .eq("is_active", true)
          .order("position"),
        supabase
          .from("sales")
          .select("*, sale_items(*)")
          .eq("status", "open")
          .not("table_id", "is", null),
      ]);
      if (tablesRes.error) throw tablesRes.error;
      if (salesRes.error) throw salesRes.error;
      setTables((tablesRes.data as DiningTable[]) ?? []);
      const map = new Map<string, SaleWithItems>();
      for (const s of (salesRes.data as SaleWithItems[]) ?? []) {
        if (s.table_id) map.set(s.table_id, s);
      }
      setOpenSales(map);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // ฟังการเปลี่ยนแปลงบิลแบบ real time (ลูกค้าสั่งของ/เรียกเก็บเงิน หรือพนักงานเครื่องอื่นแก้บิล)
  // จะได้เห็นป้าย "เรียกเก็บเงิน" ขึ้นเองโดยไม่ต้องออกจากหน้านี้แล้วกลับเข้ามาใหม่
  useEffect(() => {
    const channel = supabase
      .channel("tables-grid-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        loadTables(true);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadTables]);

  const activeTable = tables.find((t) => t.id === activeTableId) ?? null;
  const activeSale = activeTableId ? openSales.get(activeTableId) ?? null : null;

  if (activeTable) {
    return (
      <TableOrderSession
        table={activeTable}
        sale={activeSale}
        products={products}
        categories={categories}
        onBack={() => setActiveTableId(null)}
        onChanged={() => {
          loadTables(true);
          onProductsChanged();
        }}
      />
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">เลือกโต๊ะ</h1>
        {isOwner && (
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => setManageOpen(true)}
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
            จัดการโต๊ะ
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-16 text-center text-neutral-400">กำลังโหลด...</p>
      ) : loadError ? (
        <div className="py-16 text-center text-red-500">
          <AlertCircle className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p className="mb-3 text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => loadTables()}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      ) : tables.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Users className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>ยังไม่มีโต๊ะ</p>
          {isOwner && (
            <button
              className="btn-primary mt-4 inline-flex items-center gap-2"
              onClick={() => setManageOpen(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              เพิ่มโต๊ะ
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {tables.map((t) => {
            const sale = openSales.get(t.id);
            const occupied = !!sale;
            const billRequested = !!sale?.bill_requested_at;
            const pendingCount =
              sale?.sale_items.filter((i) => i.status === "pending").length ?? 0;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTableId(t.id)}
                className={`card relative flex flex-col items-center gap-1 p-5 text-center transition active:scale-[0.97] ${
                  billRequested
                    ? "border-amber-300 bg-amber-50"
                    : occupied
                      ? "border-brand-300 bg-brand-50"
                      : "hover:border-brand-300"
                }`}
              >
                {pendingCount > 0 && (
                  <span className="absolute -left-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow">
                    {pendingCount}
                  </span>
                )}
                {billRequested && (
                  <span className="absolute -top-2 right-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    <Bell className="h-3 w-3" strokeWidth={2.5} />
                    เรียกเก็บเงิน
                  </span>
                )}
                <span
                  className={`text-lg font-bold ${
                    billRequested
                      ? "text-amber-700"
                      : occupied
                        ? "text-brand-700"
                        : "text-neutral-800"
                  }`}
                >
                  {t.name}
                </span>
                {occupied ? (
                  <>
                    <span
                      className={`text-sm font-semibold ${billRequested ? "text-amber-600" : "text-brand-600"}`}
                    >
                      {baht(Number(sale!.subtotal))}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatDateTime(sale!.created_at)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-neutral-400">ว่าง</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {manageOpen && (
        <TableManageModal
          tables={tables}
          onClose={() => setManageOpen(false)}
          onChanged={loadTables}
        />
      )}
    </div>
  );
}

function TableOrderSession({
  table,
  sale,
  products,
  categories,
  onBack,
  onChanged,
}: {
  table: DiningTable;
  sale: SaleWithItems | null;
  products: Product[];
  categories: Category[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [round, setRound] = useState<RoundItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const roundTotal = round.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const roundCount = round.reduce((s, i) => s + i.quantity, 0);
  const existingTotal = sale ? Number(sale.subtotal) : 0;

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
    const { error } = await supabase.rpc("add_order_to_table", {
      p_table_id: table.id,
      p_items: round.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
      })),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(`ส่งออเดอร์ไม่สำเร็จ: ${error.message}`);
      return;
    }
    setRound([]);
    setPanelOpen(false);
    onChanged();
  }

  async function editExistingItem(saleItemId: string, newQuantity: number) {
    setEditingItemId(saleItemId);
    setEditError(null);
    const { error } = await supabase.rpc("update_table_order_item", {
      p_sale_item_id: saleItemId,
      p_quantity: newQuantity,
    });
    setEditingItemId(null);
    if (error) {
      setEditError(`แก้ไขรายการไม่สำเร็จ: ${error.message}`);
      return;
    }
    onChanged();
  }

  async function advanceItemStatus(saleItemId: string, newStatus: SaleItemStatus) {
    setStatusBusyId(saleItemId);
    setStatusError(null);
    const { error } = await supabase.rpc("update_sale_item_status", {
      p_sale_item_id: saleItemId,
      p_status: newStatus,
    });
    setStatusBusyId(null);
    if (error) {
      setStatusError(`อัปเดตสถานะไม่สำเร็จ: ${error.message}`);
      return;
    }
    onChanged();
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
          <button
            onClick={onBack}
            className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <div>
            <p className="font-bold">{table.name}</p>
            <p className="text-xs text-neutral-500">
              {sale ? `ยอดสั่งแล้ว ${baht(existingTotal)}` : "ยังไม่มีออเดอร์"}
            </p>
          </div>
        </div>

        <ProductPicker
          products={products}
          categories={categories}
          onAdd={addToRound}
        />
      </div>

      {/* แผงออเดอร์: จอใหญ่แสดงข้างขวา */}
      <div className="hidden w-96 shrink-0 border-l border-neutral-200 bg-white lg:flex lg:flex-col">
        <OrderPanel
          table={table}
          sale={sale}
          round={round}
          roundTotal={roundTotal}
          submitting={submitting}
          submitError={submitError}
          onChangeQty={changeQty}
          onSubmitRound={submitRound}
          onCheckout={() => setCheckoutOpen(true)}
          editingItemId={editingItemId}
          editError={editError}
          onEditItem={editExistingItem}
          statusBusyId={statusBusyId}
          statusError={statusError}
          onAdvanceStatus={advanceItemStatus}
        />
      </div>

      {/* มือถือ: ปุ่มลอย + sheet */}
      {(roundCount > 0 || (sale && sale.sale_items.length > 0)) && !panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="fixed inset-x-4 bottom-20 z-40 flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-white shadow-xl active:scale-[0.98] md:bottom-4 md:left-60 lg:hidden"
        >
          <span className="font-semibold">
            {table.name} · {roundCount > 0 ? `+${formatNumber(roundCount)} รายการใหม่` : "ดูออเดอร์"}
          </span>
          <span className="text-lg font-bold">{baht(existingTotal + roundTotal)}</span>
        </button>
      )}

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 lg:hidden">
          <div className="absolute inset-0" onClick={() => setPanelOpen(false)} />
          <div className="relative flex max-h-[85dvh] flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="text-lg font-bold">{table.name}</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <OrderPanel
              table={table}
              sale={sale}
              round={round}
              roundTotal={roundTotal}
              submitting={submitting}
              submitError={submitError}
              onChangeQty={changeQty}
              onSubmitRound={submitRound}
              onCheckout={() => setCheckoutOpen(true)}
              editingItemId={editingItemId}
              editError={editError}
              onEditItem={editExistingItem}
              statusBusyId={statusBusyId}
              statusError={statusError}
              onAdvanceStatus={advanceItemStatus}
            />
          </div>
        </div>
      )}

      {checkoutOpen && sale && (
        <TableCheckoutModal
          table={table}
          sale={sale}
          onClose={() => setCheckoutOpen(false)}
          onDone={() => {
            setCheckoutOpen(false);
            onChanged();
            onBack();
          }}
        />
      )}
    </div>
  );
}

function OrderPanel({
  table,
  sale,
  round,
  roundTotal,
  submitting,
  submitError,
  onChangeQty,
  onSubmitRound,
  onCheckout,
  editingItemId,
  editError,
  onEditItem,
  statusBusyId,
  statusError,
  onAdvanceStatus,
}: {
  table: DiningTable;
  sale: SaleWithItems | null;
  round: RoundItem[];
  roundTotal: number;
  submitting: boolean;
  submitError: string | null;
  onChangeQty: (productId: string, delta: number) => void;
  onSubmitRound: () => void;
  onCheckout: () => void;
  editingItemId: string | null;
  editError: string | null;
  onEditItem: (saleItemId: string, newQuantity: number) => void;
  statusBusyId: string | null;
  statusError: string | null;
  onAdvanceStatus: (saleItemId: string, newStatus: SaleItemStatus) => void;
}) {
  const existingTotal = sale ? Number(sale.subtotal) : 0;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        {sale && sale.sale_items.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">
              สั่งไปแล้ว (แก้ไขได้ถ้ากดผิด)
            </p>
            <ul className="space-y-2">
              {sale.sale_items.map((item) => {
                const qty = Number(item.quantity);
                const busy = editingItemId === item.id;
                const statusBusy = statusBusyId === item.id;
                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-neutral-200 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {baht(Number(item.total))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={busy}
                          onClick={() => onEditItem(item.id, qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600 active:scale-95 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {formatNumber(qty)}
                        </span>
                        <button
                          disabled={busy}
                          onClick={() => onEditItem(item.id, qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600 active:scale-95 disabled:opacity-40"
                        >
                          +
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onEditItem(item.id, 0)}
                          className="ml-1 p-1 text-neutral-300 hover:text-red-500 disabled:opacity-40"
                          aria-label="ลบรายการ"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.status === "served"
                            ? "bg-green-50 text-green-600"
                            : item.status === "accepted"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {SALE_ITEM_STATUS_LABELS[item.status]}
                      </span>
                      {item.status !== "served" && (
                        <button
                          disabled={statusBusy}
                          onClick={() =>
                            onAdvanceStatus(
                              item.id,
                              item.status === "pending" ? "accepted" : "served"
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white active:scale-95 disabled:opacity-40 ${
                            item.status === "pending" ? "bg-amber-500" : "bg-green-600"
                          }`}
                        >
                          {item.status === "pending" ? "รับออเดอร์" : "เสิร์ฟแล้ว"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {editError && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {editError}
              </p>
            )}
            {statusError && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {statusError}
              </p>
            )}
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
                  <p className="truncate text-sm font-medium">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {baht(item.product.price)} × {formatNumber(item.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onChangeQty(item.product.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600 active:scale-95"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {formatNumber(item.quantity)}
                  </span>
                  <button
                    onClick={() => onChangeQty(item.product.id, 1)}
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
      </div>

      <div className="space-y-2 border-t border-neutral-200 p-4">
        {round.length > 0 && (
          <button
            className="btn-secondary w-full py-3"
            disabled={submitting}
            onClick={onSubmitRound}
          >
            {submitting ? "กำลังส่ง..." : `ส่งออเดอร์ (+${baht(roundTotal)})`}
          </button>
        )}
        <div className="flex items-center justify-between px-1">
          <span className="text-neutral-500">ยอดรวม{table.name}</span>
          <span className="text-2xl font-bold">
            {baht(existingTotal + roundTotal)}
          </span>
        </div>
        <button
          className="btn-primary w-full py-3.5 text-lg"
          disabled={!sale || sale.sale_items.length === 0}
          onClick={onCheckout}
        >
          เก็บเงิน / ปิดโต๊ะ
        </button>
      </div>
    </>
  );
}

function TableCheckoutModal({
  table,
  sale,
  onClose,
  onDone,
}: {
  table: DiningTable;
  sale: SaleWithItems;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [discountStr, setDiscountStr] = useState("");
  const [receivedStr, setReceivedStr] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ total: number; change: number | null } | null>(
    null
  );

  const subtotal = Number(sale.subtotal);
  const discount = Math.max(parseFloat(discountStr) || 0, 0);
  const total = Math.max(subtotal - discount, 0);
  const received = parseFloat(receivedStr) || 0;
  const cashInsufficient = method === "cash" && received < total;

  async function confirm() {
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("checkout_table", {
      p_sale_id: sale.id,
      p_discount: discount,
      p_payment_method: method,
      p_received: method === "cash" ? received : null,
      p_note: note.trim() || null,
    });
    if (error) {
      setError(`เก็บเงินไม่สำเร็จ: ${error.message}`);
      setSaving(false);
      return;
    }
    setDone({
      total,
      change: method === "cash" ? Math.max(received - total, 0) : null,
    });
    setSaving(false);
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold">ปิดโต๊ะสำเร็จ!</h2>
          <p className="mt-2 text-3xl font-bold text-brand-600">
            {baht(done.total)}
          </p>
          {done.change !== null && (
            <div className="mt-4 rounded-2xl bg-green-50 p-4">
              <p className="text-sm text-green-600">เงินทอน</p>
              <p className="text-3xl font-bold text-green-700">
                {baht(done.change)}
              </p>
            </div>
          )}
          <button className="btn-primary mt-6 w-full py-3" onClick={onDone}>
            เสร็จสิ้น
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">เก็บเงิน — {table.name}</h2>
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
            {saving ? "กำลังบันทึก..." : `ยืนยันเก็บเงิน ${baht(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function TableManageModal({
  tables,
  onClose,
  onChanged,
}: {
  tables: DiningTable[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);

  async function addTable(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("dining_tables").insert({
      name: name.trim(),
      position: tables.length + 1,
    });
    setSaving(false);
    if (error) {
      setError(`เพิ่มโต๊ะไม่สำเร็จ: ${error.message}`);
      return;
    }
    setName("");
    onChanged();
  }

  async function removeTable(t: DiningTable) {
    if (!window.confirm(`ลบ "${t.name}" ?`)) return;
    await supabase
      .from("dining_tables")
      .update({ is_active: false })
      .eq("id", t.id);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">จัดการโต๊ะ</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={addTable} className="mb-4 flex gap-2">
            <input
              className="input flex-1"
              placeholder="ชื่อโต๊ะใหม่ เช่น โต๊ะ 6"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !name.trim()}
            >
              เพิ่ม
            </button>
          </form>

          {error && (
            <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {tables.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">
              ยังไม่มีโต๊ะ
            </p>
          ) : (
            <ul className="space-y-2">
              {tables.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <span className="font-medium">{t.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-brand-600"
                      onClick={() => setQrTable(t)}
                      aria-label="ดู QR โต๊ะ"
                    >
                      <QrCode className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <button
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      onClick={() => removeTable(t)}
                      aria-label="ลบโต๊ะ"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-200 p-4 px-6">
          <button className="btn-secondary w-full" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      {qrTable && (
        <TableQrModal table={qrTable} onClose={() => setQrTable(null)} />
      )}
    </div>
  );
}

function TableQrModal({
  table,
  onClose,
}: {
  table: DiningTable;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const orderUrl = `${window.location.origin}/order/${table.id}`;
    setUrl(orderUrl);
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(orderUrl, { width: 480, margin: 2 }).then(setDataUrl);
    });
  }, [table.id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">QR สั่งอาหาร · {table.name}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR โต๊ะ ${table.name}`}
            className="mx-auto h-56 w-56 rounded-xl border border-neutral-200"
          />
        ) : (
          <div className="mx-auto flex h-56 w-56 items-center justify-center text-neutral-400">
            กำลังสร้าง QR...
          </div>
        )}

        <p className="mt-3 break-all text-xs text-neutral-400">{url}</p>

        <div className="mt-4 flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            ปิด
          </button>
          {dataUrl && (
            <a
              href={dataUrl}
              download={`qr-${table.name}.png`}
              className="btn-primary flex-1"
            >
              ดาวน์โหลด
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
