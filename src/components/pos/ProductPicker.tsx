"use client";

import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { baht, formatNumber } from "@/lib/format";
import { Category, Product } from "@/lib/types";

export default function ProductPicker({
  products,
  categories,
  onAdd,
}: {
  products: Product[];
  categories: Category[];
  onAdd: (product: Product) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryId]);

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="mb-3 flex gap-2">
        <input
          className="input"
          placeholder="ค้นหาชื่อสินค้า หรือสแกน/พิมพ์บาร์โค้ด..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            // สแกนบาร์โค้ดแล้วกด Enter — ถ้าตรงพอดี 1 ชิ้น เพิ่มลงตะกร้าเลย
            if (e.key === "Enter") {
              const exact = products.find(
                (p) => p.barcode && p.barcode === search.trim()
              );
              const target = exact ?? (filtered.length === 1 ? filtered[0] : null);
              if (target) {
                onAdd(target);
                setSearch("");
              }
            }
          }}
        />
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <CategoryChip
          label="ทั้งหมด"
          active={categoryId === null}
          onClick={() => setCategoryId(null)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            label={c.name}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-neutral-400">
          <Package className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p>
            {products.length === 0
              ? "ยังไม่มีสินค้า — ไปที่เมนู “สินค้า” เพื่อเพิ่มสินค้า"
              : "ไม่พบสินค้าที่ค้นหา"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={() => onAdd(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {label}
    </button>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  const outOfStock = product.track_stock && product.stock <= 0;
  const lowStock =
    product.track_stock &&
    product.stock > 0 &&
    product.stock <= product.low_stock_threshold;

  return (
    <button
      onClick={onAdd}
      className="card relative flex flex-col overflow-hidden text-left transition active:scale-[0.97] hover:border-brand-300"
    >
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-neutral-50">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-10 w-10 text-neutral-300" strokeWidth={1.5} />
          </div>
        )}
      </div>
      {product.track_stock && (
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
            outOfStock
              ? "bg-red-100 text-red-600"
              : lowStock
                ? "bg-amber-100 text-amber-700"
                : "bg-white/90 text-neutral-600"
          }`}
        >
          {outOfStock ? "หมด" : `เหลือ ${formatNumber(product.stock)}`}
        </span>
      )}
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">
          {product.name}
        </p>
        <p className="mt-auto pt-1 font-bold text-brand-600">
          {baht(product.price)}
        </p>
      </div>
    </button>
  );
}
