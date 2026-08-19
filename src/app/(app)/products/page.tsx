"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ImageOff,
  Package,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { Category, hasRole, Product, STOCK_GROUP_LABELS, StockGroup } from "@/lib/types";
import RequireRole from "@/components/RequireRole";
import { useProfile } from "@/components/ProfileProvider";

type ProductForm = {
  name: string;
  barcode: string;
  category_id: string;
  price: string;
  cost: string;
  stock: string;
  track_stock: boolean;
  low_stock_threshold: string;
  stock_group: StockGroup | "";
  image_url: string;
};

const EMPTY_FORM: ProductForm = {
  name: "",
  barcode: "",
  category_id: "",
  price: "",
  cost: "",
  stock: "0",
  track_stock: true,
  low_stock_threshold: "5",
  stock_group: "",
  image_url: "",
};

export default function ProductsPage() {
  return (
    <RequireRole min="staff">
      <ProductsPageContent />
    </RequireRole>
  );
}

function ProductsPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const isOwner = !!profile && hasRole(profile.role, "owner");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [savingSoldOutId, setSavingSoldOutId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "stock">("list");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase.from("categories").select("*").order("position"),
      ]);
      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;
      setProducts((prodRes.data as Product[]) ?? []);
      setCategories((catRes.data as Category[]) ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "-";

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setModalOpen(true);
  }

  async function handleDelete(p: Product) {
    if (!window.confirm(`ลบสินค้า "${p.name}" ?\n(ประวัติการขายเดิมจะยังอยู่ครบ)`))
      return;
    await supabase.from("products").update({ is_active: false }).eq("id", p.id);
    loadData();
  }

  async function toggleSoldOut(p: Product, soldOut: boolean) {
    setSavingSoldOutId(p.id);
    setProducts((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, is_sold_out: soldOut } : item))
    );
    const { error } = await supabase
      .from("products")
      .update({ is_sold_out: soldOut, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setSavingSoldOutId(null);
    if (error) {
      window.alert(`บันทึกไม่สำเร็จ: ${error.message}`);
      loadData();
    }
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">จัดการสินค้า</h1>
        <div className="flex gap-2">
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => setCatModalOpen(true)}
          >
            <Tag className="h-4 w-4" strokeWidth={2} />
            หมวดหมู่
          </button>
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            เพิ่มสินค้า
          </button>
        </div>
      </div>

      {isOwner && (
        <div className="mb-4 flex gap-2">
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              view === "list"
                ? "bg-brand-600 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
            onClick={() => setView("list")}
          >
            รายการสินค้า
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              view === "stock"
                ? "bg-brand-600 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
            onClick={() => setView("stock")}
          >
            ภาพรวม stock
          </button>
        </div>
      )}

      {view === "stock" && isOwner ? (
        loading ? (
          <p className="py-16 text-center text-neutral-400">กำลังโหลด...</p>
        ) : (
          <StockOverview products={products} />
        )
      ) : (
        <>
      <input
        className="input mb-4 max-w-md"
        placeholder="ค้นหาชื่อสินค้า หรือบาร์โค้ด..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={100}
      />

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
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Package className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>{products.length === 0 ? "ยังไม่มีสินค้า — กด “เพิ่มสินค้า” เพื่อเริ่มต้น" : "ไม่พบสินค้าที่ค้นหา"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <ProductListRow
              key={p.id}
              product={p}
              isOwner={isOwner}
              categoryName={catName(p.category_id)}
              savingSoldOut={savingSoldOutId === p.id}
              onEdit={() => openEdit(p)}
              onDelete={() => handleDelete(p)}
              onToggleSoldOut={(soldOut) => toggleSoldOut(p, soldOut)}
            />
          ))}
        </div>
      )}
        </>
      )}

      {modalOpen && (
        <ProductModal
          product={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            loadData();
          }}
        />
      )}

      {catModalOpen && (
        <CategoryModal
          categories={categories}
          onClose={() => setCatModalOpen(false)}
          onChanged={loadData}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const isOwner = !!profile && hasRole(profile.role, "owner");
  const isManagerUp = !!profile && hasRole(profile.role, "manager");
  const [editorName, setEditorName] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(
    product
      ? {
          name: product.name,
          barcode: product.barcode ?? "",
          category_id: product.category_id ?? "",
          price: String(product.price),
          cost: String(product.cost),
          stock: String(product.stock),
          track_stock: product.track_stock,
          low_stock_threshold: String(product.low_stock_threshold),
          stock_group: product.stock_group ?? "",
          image_url: product.image_url ?? "",
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const set = (patch: Partial<ProductForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  const price = parseFloat(form.price) || 0;
  const cost = parseFloat(form.cost) || 0;

  // ใครแก้ไขสินค้านี้ล่าสุด — โปรไฟล์คนอื่นอ่านได้เฉพาะผู้จัดการขึ้นไปตาม RLS
  useEffect(() => {
    if (!product?.updated_by || !isManagerUp) {
      setEditorName(null);
      return;
    }
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", product.updated_by)
      .maybeSingle()
      .then(({ data }) => {
        setEditorName(data?.full_name || data?.phone || null);
      });
  }, [supabase, product?.updated_by, isManagerUp]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("เลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError("ไฟล์ใหญ่เกิน 15MB");
      return;
    }
    setUploading(true);
    setUploadError(null);
    let uploadBody: File | Blob = file;
    try {
      uploadBody = await compressImage(file);
    } catch {
      // ถ้าย่อไม่สำเร็จ (เบราว์เซอร์เก่า ฯลฯ) ใช้ไฟล์ต้นฉบับแทน
    }
    const path = `${crypto.randomUUID()}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, uploadBody, {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadErr) {
      setUploadError(`อัปโหลดไม่สำเร็จ: ${uploadErr.message}`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    set({ image_url: data.publicUrl });
    setUploading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const nextStock = parseFloat(form.stock) || 0;
    // ฟอร์มโหลดค่า stock แค่ตอนเปิดครั้งแรก ถ้าเปิดฟอร์มค้างไว้แก้เรื่องอื่น (เช่นราคา) โดยไม่ได้
    // แตะช่องนี้เลย แล้วระหว่างนั้นมีการขายตัดสต๊อกไปแล้ว การเซฟจะทับสต๊อกด้วยเลขเก่าที่ค้างอยู่
    // ทำให้ยอดขายที่เพิ่งตัดไปหายไปเฉยๆ จึงส่ง stock ไปอัปเดตเฉพาะตอนพนักงานแก้เลขนี้จริงๆ เท่านั้น
    const stockChanged = !product || nextStock !== product.stock;

    const { error } = product
      ? await supabase.rpc("update_product", {
          p_id: product.id,
          p_name: form.name.trim(),
          p_barcode: form.barcode.trim() || null,
          p_category_id: form.category_id || null,
          p_price: price,
          p_cost: cost,
          p_stock: stockChanged ? nextStock : null,
          p_track_stock: form.track_stock,
          p_low_stock_threshold: parseFloat(form.low_stock_threshold) || 0,
          p_stock_group: form.stock_group || null,
          p_image_url: form.image_url.trim() || null,
        })
      : await supabase.from("products").insert({
          name: form.name.trim(),
          barcode: form.barcode.trim() || null,
          category_id: form.category_id || null,
          price,
          cost,
          stock: nextStock,
          track_stock: form.track_stock,
          low_stock_threshold: parseFloat(form.low_stock_threshold) || 0,
          stock_group: form.stock_group || null,
          image_url: form.image_url.trim() || null,
        });
    if (error) {
      setError(`บันทึกไม่สำเร็จ: ${error.message}`);
      setSaving(false);
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
          <h2 className="text-xl font-bold">
            {product ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <Field label="ชื่อสินค้า *">
            <input
              className="input"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              required
              autoFocus
              maxLength={100}
            />
          </Field>

          <div className={isOwner ? "grid grid-cols-2 gap-3" : ""}>
            <Field label="ราคาขาย (บาท) *">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="input"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
                required
              />
            </Field>
            {isOwner && (
              <Field label="ต้นทุน (บาท)">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  className="input"
                  value={form.cost}
                  onChange={(e) => set({ cost: e.target.value })}
                />
              </Field>
            )}
          </div>

          {isOwner && price > 0 && (
            <p className="rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-700">
              กำไรต่อชิ้น: <b>{baht(price - cost)}</b>{" "}
              {price > 0 && `(${(((price - cost) / price) * 100).toFixed(1)}%)`}
            </p>
          )}

          <Field label="หมวดหมู่">
            <select
              className="input"
              value={form.category_id}
              onChange={(e) => set({ category_id: e.target.value })}
            >
              <option value="">— ไม่ระบุ —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          {isOwner && (
            <Field label="บาร์โค้ด">
              <input
                className="input"
                value={form.barcode}
                onChange={(e) => set({ barcode: e.target.value })}
                placeholder="สแกนหรือพิมพ์บาร์โค้ด"
                maxLength={50}
              />
            </Field>
          )}

          {isOwner ? (
            <>
              <label className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brand-600"
                  checked={form.track_stock}
                  onChange={(e) => set({ track_stock: e.target.checked })}
                />
                <span className="text-sm font-medium">
                  นับสต๊อก (ตัดจำนวนอัตโนมัติเมื่อขาย)
                </span>
              </label>

              {form.track_stock && (
                <>
                  <Field label="จำนวนคงเหลือ">
                    <QuantityStepper
                      value={form.stock}
                      onChange={(v) => set({ stock: v })}
                    />
                  </Field>
                  <Field label="แจ้งเตือนเมื่อต่ำกว่า">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      className="input"
                      value={form.low_stock_threshold}
                      onChange={(e) => set({ low_stock_threshold: e.target.value })}
                    />
                  </Field>
                </>
              )}

              {form.track_stock && (
                <Field label="กลุ่มสต๊อก (สำหรับหน้าภาพรวม stock)">
                  <select
                    className="input"
                    value={form.stock_group}
                    onChange={(e) => set({ stock_group: e.target.value as StockGroup | "" })}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {(Object.keys(STOCK_GROUP_LABELS) as StockGroup[]).map((g) => (
                      <option key={g} value={g}>
                        {STOCK_GROUP_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          ) : (
            <Field label="จำนวน">
              <QuantityStepper
                value={form.stock}
                onChange={(v) => set({ stock: v })}
              />
            </Field>
          )}

          {editorName && (
            <p className="-mt-2 text-xs text-neutral-400">
              แก้ไขข้อมูลล่าสุดโดย {editorName}
            </p>
          )}

          <Field label="รูปภาพสินค้า (ถ้ามี)">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                {form.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageOff className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />
                )}
              </div>
              <label className="btn-secondary inline-flex flex-1 cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-sm">
                <Upload className="h-4 w-4" strokeWidth={2} />
                {uploading ? "กำลังอัปโหลด..." : "เลือกรูปจากเครื่อง"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
            </div>
            <input
              type="url"
              className="input mt-2"
              value={form.image_url}
              onChange={(e) => set({ image_url: e.target.value })}
              placeholder="หรือวางลิงก์รูปภาพเอง (https://...)"
              maxLength={2000}
            />
            {uploadError && (
              <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>
            )}
          </Field>

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

function ProductListRow({
  product: p,
  isOwner,
  categoryName,
  savingSoldOut,
  onEdit,
  onDelete,
  onToggleSoldOut,
}: {
  product: Product;
  isOwner: boolean;
  categoryName: string;
  savingSoldOut: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSoldOut: (soldOut: boolean) => void;
}) {
  const low = p.track_stock && p.stock <= p.low_stock_threshold;

  return (
    <div className={`card flex items-center gap-3 p-2.5 ${p.is_sold_out ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={onEdit}
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-50"
      >
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image_url}
            alt={p.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-6 w-6 text-neutral-300" strokeWidth={1.5} />
          </div>
        )}
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold leading-snug">
          {p.name}
        </p>
        <p className="truncate text-xs text-neutral-400">
          {categoryName}
          {p.barcode ? ` · ${p.barcode}` : ""}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold text-brand-600">{baht(p.price)}</span>
          {isOwner && (
            <span className="text-xs text-green-600">
              กำไร {baht(p.price - p.cost)}
            </span>
          )}
          {p.track_stock && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                p.stock <= 0
                  ? "bg-red-100 text-red-600"
                  : low
                    ? "bg-amber-100 text-amber-700"
                    : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {p.stock <= 0 ? "หมด" : `เหลือ ${formatNumber(p.stock)}`}
            </span>
          )}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onToggleSoldOut(!p.is_sold_out)}
          disabled={savingSoldOut}
          className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
            p.is_sold_out ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {p.is_sold_out ? "ของหมด" : "มีของขาย"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 active:scale-95"
          aria-label="ลบสินค้า"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function CategoryModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("categories").insert({
      name: name.trim(),
      position: categories.length + 1,
    });
    setName("");
    setSaving(false);
    onChanged();
  }

  async function removeCategory(c: Category) {
    if (!window.confirm(`ลบหมวดหมู่ "${c.name}" ?\n(สินค้าในหมวดนี้จะกลายเป็น “ไม่ระบุ”)`))
      return;
    await supabase.from("categories").delete().eq("id", c.id);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">หมวดหมู่สินค้า</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={addCategory} className="mb-4 flex gap-2">
            <input
              className="input flex-1"
              placeholder="ชื่อหมวดหมู่ใหม่..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !name.trim()}
            >
              เพิ่ม
            </button>
          </form>

          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">
              ยังไม่มีหมวดหมู่
            </p>
          ) : (
            <ul className="space-y-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <span className="font-medium">{c.name}</span>
                  <button
                    className="text-sm text-red-500 hover:underline"
                    onClick={() => removeCategory(c)}
                  >
                    ลบ
                  </button>
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

function QuantityStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  function bump(delta: number) {
    const next = Math.max(0, (parseFloat(value) || 0) + delta);
    onChange(String(next));
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => bump(-1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl font-bold text-neutral-600 transition active:scale-95 hover:bg-neutral-200"
        aria-label="ลดจำนวน"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        className="input text-center text-lg font-semibold"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => bump(1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl font-bold text-neutral-600 transition active:scale-95 hover:bg-neutral-200"
        aria-label="เพิ่มจำนวน"
      >
        +
      </button>
    </div>
  );
}

const STOCK_GROUP_ORDER: StockGroup[] = ["ingredient", "supply", "beverage"];

function StockOverview({ products }: { products: Product[] }) {
  const tracked = products.filter((p) => p.track_stock);
  const outOfStock = tracked.filter((p) => p.stock <= 0);
  const lowStock = tracked.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold);
  const totalValue = tracked.reduce((s, p) => s + p.stock * p.cost, 0);

  // แยกเป็นกลุ่มสต๊อก (วัตถุดิบ/ของใช้/เครื่องดื่ม) ให้ดูง่ายขึ้น — แยกต่างหากจากหมวดหมู่เมนูที่ลูกค้าเห็น
  // ตั้งกลุ่มได้ตอนเพิ่ม/แก้ไขสินค้า (ช่อง "กลุ่มสต๊อก")
  const byGroup = new Map<string, Product[]>();
  for (const p of tracked) {
    const key = p.stock_group ?? "__none__";
    const list = byGroup.get(key) ?? [];
    list.push(p);
    byGroup.set(key, list);
  }
  const groups: { id: string; name: string; items: Product[] }[] = [];
  for (const g of STOCK_GROUP_ORDER) {
    const items = byGroup.get(g);
    if (items && items.length > 0) {
      groups.push({ id: g, name: STOCK_GROUP_LABELS[g], items: [...items].sort((a, b) => a.stock - b.stock) });
    }
  }
  const unclassified = byGroup.get("__none__");
  if (unclassified && unclassified.length > 0) {
    groups.push({
      id: "__none__",
      name: "ไม่ระบุกลุ่ม",
      items: [...unclassified].sort((a, b) => a.stock - b.stock),
    });
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="สินค้านับสต๊อก" value={formatNumber(tracked.length)} accent="text-neutral-900" />
        <StatCard label="ใกล้หมด" value={formatNumber(lowStock.length)} accent="text-amber-600" />
        <StatCard label="หมดแล้ว" value={formatNumber(outOfStock.length)} accent="text-red-600" />
        <StatCard label="มูลค่าสต๊อกรวม (ตามต้นทุน)" value={baht(totalValue)} accent="text-brand-600" />
      </div>

      {tracked.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Package className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>ยังไม่มีสินค้าที่ตั้งค่านับสต๊อกไว้</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700">
                {group.name}
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                  {formatNumber(group.items.length)}
                </span>
              </p>

              {/* ตารางสำหรับจอใหญ่ */}
              <div className="card hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-neutral-500">
                      <th className="px-4 py-3 font-medium">สินค้า</th>
                      <th className="px-4 py-3 text-right font-medium">คงเหลือ</th>
                      <th className="px-4 py-3 text-right font-medium">แจ้งเตือนเมื่อต่ำกว่า</th>
                      <th className="px-4 py-3 text-right font-medium">ต้นทุน/ชิ้น</th>
                      <th className="px-4 py-3 text-right font-medium">มูลค่าคงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((p) => {
                      const out = p.stock <= 0;
                      const low = !out && p.stock <= p.low_stock_threshold;
                      return (
                        <tr key={p.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              out ? "text-red-600" : low ? "text-amber-600" : ""
                            }`}
                          >
                            {formatNumber(p.stock)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-400">
                            {formatNumber(p.low_stock_threshold)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-500">{baht(p.cost)}</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {baht(p.stock * p.cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* การ์ดสำหรับมือถือ */}
              <div className="space-y-2 md:hidden">
                {group.items.map((p) => {
                  const out = p.stock <= 0;
                  const low = !out && p.stock <= p.low_stock_threshold;
                  return (
                    <div key={p.id} className="card p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{p.name}</p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            out
                              ? "bg-red-100 text-red-600"
                              : low
                                ? "bg-amber-100 text-amber-700"
                                : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          เหลือ {formatNumber(p.stock)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>ต้นทุน {baht(p.cost)}/ชิ้น</span>
                        <span className="font-semibold text-neutral-900">
                          มูลค่า {baht(p.stock * p.cost)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-500 md:text-sm">{label}</p>
      <p className={`mt-1 text-xl font-bold md:text-2xl ${accent}`}>{value}</p>
    </div>
  );
}
