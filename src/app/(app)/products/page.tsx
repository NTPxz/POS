"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ImageOff,
  Package,
  Plus,
  RefreshCw,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { baht, formatNumber } from "@/lib/format";
import { Category, Product } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

type ProductForm = {
  name: string;
  barcode: string;
  category_id: string;
  price: string;
  cost: string;
  stock: string;
  track_stock: boolean;
  low_stock_threshold: string;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [savingSoldOutId, setSavingSoldOutId] = useState<string | null>(null);

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
        <>
          {/* ตารางสำหรับจอใหญ่ */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="px-4 py-3 font-medium">สินค้า</th>
                  <th className="px-4 py-3 font-medium">หมวดหมู่</th>
                  <th className="px-4 py-3 text-right font-medium">ราคาขาย</th>
                  <th className="px-4 py-3 text-right font-medium">ต้นทุน</th>
                  <th className="px-4 py-3 text-right font-medium">กำไร/ชิ้น</th>
                  <th className="px-4 py-3 text-right font-medium">คงเหลือ</th>
                  <th className="px-4 py-3 text-center font-medium">ของหมด</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = p.track_stock && p.stock <= p.low_stock_threshold;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50 ${
                        p.is_sold_out ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {p.name}
                          {p.is_sold_out && (
                            <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                              ของหมด
                            </span>
                          )}
                        </p>
                        {p.barcode && (
                          <p className="text-xs text-neutral-400">{p.barcode}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {catName(p.category_id)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {baht(p.price)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-500">
                        {baht(p.cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {baht(p.price - p.cost)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.track_stock ? (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              p.stock <= 0
                                ? "text-red-600"
                                : low
                                  ? "text-amber-600"
                                  : ""
                            }`}
                          >
                            {formatNumber(p.stock)}
                            {low && (
                              <AlertTriangle
                                className="h-3.5 w-3.5"
                                strokeWidth={2}
                              />
                            )}
                          </span>
                        ) : (
                          <span className="text-neutral-400">ไม่นับ</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-red-500"
                          checked={p.is_sold_out}
                          disabled={savingSoldOutId === p.id}
                          onChange={(e) => toggleSoldOut(p, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="mr-1 rounded-lg px-3 py-1.5 text-brand-600 hover:bg-brand-50"
                          onClick={() => openEdit(p)}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="rounded-lg px-3 py-1.5 text-red-500 hover:bg-red-50"
                          onClick={() => handleDelete(p)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* การ์ดสำหรับมือถือ */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => {
              const low = p.track_stock && p.stock <= p.low_stock_threshold;
              return (
                <div key={p.id} className={`card p-4 ${p.is_sold_out ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {p.name}
                        {p.is_sold_out && (
                          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                            ของหมด
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {catName(p.category_id)}
                        {p.barcode ? ` · ${p.barcode}` : ""}
                      </p>
                    </div>
                    {p.track_stock && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          p.stock <= 0
                            ? "bg-red-100 text-red-600"
                            : low
                              ? "bg-amber-100 text-amber-700"
                              : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        เหลือ {formatNumber(p.stock)}
                      </span>
                    )}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-red-500"
                      checked={p.is_sold_out}
                      disabled={savingSoldOutId === p.id}
                      onChange={(e) => toggleSoldOut(p, e.target.checked)}
                    />
                    ของหมด (ปิดขายชั่วคราว)
                  </label>

                  <div className="mt-3 flex items-end justify-between">
                    <div className="text-sm text-neutral-500">
                      <p>
                        ขาย{" "}
                        <span className="font-bold text-neutral-900">
                          {baht(p.price)}
                        </span>{" "}
                        · ทุน {baht(p.cost)}
                      </p>
                      <p className="text-green-600">
                        กำไร {baht(p.price - p.cost)}/ชิ้น
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600"
                        onClick={() => openEdit(p)}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-500"
                        onClick={() => handleDelete(p)}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("เลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("ไฟล์ใหญ่เกิน 5MB");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
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
    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      price,
      cost,
      stock: parseFloat(form.stock) || 0,
      track_stock: form.track_stock,
      low_stock_threshold: parseFloat(form.low_stock_threshold) || 0,
      image_url: form.image_url.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
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

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {price > 0 && (
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

          <Field label="บาร์โค้ด">
            <input
              className="input"
              value={form.barcode}
              onChange={(e) => set({ barcode: e.target.value })}
              placeholder="สแกนหรือพิมพ์บาร์โค้ด"
              maxLength={50}
            />
          </Field>

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
            <div className="grid grid-cols-2 gap-3">
              <Field label="จำนวนคงเหลือ">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className="input"
                  value={form.stock}
                  onChange={(e) => set({ stock: e.target.value })}
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
            </div>
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
