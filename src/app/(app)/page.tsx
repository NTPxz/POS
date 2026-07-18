"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, ShoppingCart, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Category, Product } from "@/lib/types";
import QuickSaleView from "@/components/pos/QuickSaleView";
import TablesView from "@/components/pos/TablesView";

type Mode = "quick" | "tables";

export default function PosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("quick");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 border-b border-neutral-200 bg-white px-4 pt-3">
        <ModeTab
          label="ขายด่วน"
          icon={ShoppingCart}
          active={mode === "quick"}
          onClick={() => setMode("quick")}
        />
        <ModeTab
          label="เปิดโต๊ะ"
          icon={Users}
          active={mode === "tables"}
          onClick={() => setMode("tables")}
        />
      </div>

      {loading ? (
        <p className="flex-1 py-16 text-center text-neutral-400">
          กำลังโหลดสินค้า...
        </p>
      ) : loadError ? (
        <div className="flex-1 py-16 text-center text-red-500">
          <AlertCircle className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
          <p className="mb-3 text-sm">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => loadData()}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            ลองอีกครั้ง
          </button>
        </div>
      ) : mode === "quick" ? (
        <QuickSaleView
          products={products}
          categories={categories}
          onSaleDone={() => loadData(true)}
        />
      ) : (
        <TablesView
          products={products}
          categories={categories}
          onProductsChanged={() => loadData(true)}
        />
      )}
    </div>
  );
}

function ModeTab({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof ShoppingCart;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-3 pb-3 text-sm font-semibold transition ${
        active
          ? "border-brand-600 text-brand-600"
          : "border-transparent text-neutral-500 hover:text-neutral-700"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
      {label}
    </button>
  );
}
