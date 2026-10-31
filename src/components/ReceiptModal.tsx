"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ImageDown, Printer, RefreshCw, X } from "lucide-react";
import LoadingState from "@/components/LoadingState";
import { useBranch } from "@/components/BranchProvider";
import { buildReceipt, ReceiptData, ReceiptSale, renderReceiptImage } from "@/lib/receipt";
import { shopStorageKey } from "@/lib/shops";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/lib/useShop";

const PAPER_KEY = "receipt_paper_mm";
const PAPER_SIZES = [58, 80] as const;
type PaperSize = (typeof PAPER_SIZES)[number];

function readPaperSize(): PaperSize {
  try {
    return localStorage.getItem(shopStorageKey(PAPER_KEY)) === "58" ? 58 : 80;
  } catch {
    return 80;
  }
}

export default function ReceiptModal({
  saleId,
  onClose,
}: {
  saleId: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const shop = useShop();
  const { branches } = useBranch();
  const [sale, setSale] = useState<ReceiptSale | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paper, setPaper] = useState<PaperSize>(readPaperSize);
  const [pageHeightMm, setPageHeightMm] = useState<number | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    // ดึงใหม่ทุกครั้ง ยอดบนบิลจึงตรงกับที่บันทึกจริงแม้เพิ่งเก็บเงินเสร็จ
    const { data, error } = await supabase
      .from("sales")
      .select("*, sale_items(*), dining_tables(name)")
      .eq("id", saleId)
      .single();
    if (error) {
      setLoadError(error.message);
      return;
    }
    setSale(data as ReceiptSale);
  }, [supabase, saleId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const receipt: ReceiptData | null = useMemo(() => {
    if (!sale) return null;
    const branchName = branches.find((b) => b.id === sale.branch_id)?.name ?? null;
    return buildReceipt(
      sale,
      shop.receiptName,
      branches.length > 1 ? branchName : null
    );
  }, [sale, branches, shop.receiptName]);

  function choosePaper(size: PaperSize) {
    setPaper(size);
    try {
      localStorage.setItem(shopStorageKey(PAPER_KEY), String(size));
    } catch {
      // จำไม่ได้ก็แค่ต้องเลือกใหม่ครั้งหน้า
    }
  }

  async function handlePrint() {
    setActionError(null);
    if (!paperRef.current) return;
    await document.fonts.ready;
    // บิลยาวไม่เท่ากัน จึงตั้งความสูงหน้ากระดาษตามเนื้อหาจริง ไม่งั้นได้กระดาษเปล่ายาวต่อท้าย
    const heightMm = Math.ceil(
      (paperRef.current.getBoundingClientRect().height * 25.4) / 96
    );
    setPageHeightMm(heightMm);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }

  async function handleSaveImage() {
    if (!receipt) return;
    setSaving(true);
    setActionError(null);
    try {
      const blob = await renderReceiptImage(receipt);
      const fileName = `bill-${receipt.billNo.replace("#", "")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // บนมือถือเปิดเมนูแชร์เพื่อบันทึกลงเครื่องหรือส่งต่อ เช่น LINE ส่วนคอมดาวน์โหลดเลย
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "กรุณาลองอีกครั้ง";
      setActionError(`สร้างรูปบิลไม่สำเร็จ: ${reason}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="พิมพ์บิล"
      className="modal-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-xl font-bold">พิมพ์บิล</h2>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {loadError ? (
          <div className="px-6 py-10 text-center text-red-600">
            <AlertCircle className="mx-auto mb-2 h-10 w-10" strokeWidth={1.5} />
            <p className="mb-3 text-sm">โหลดบิลไม่สำเร็จ: {loadError}</p>
            <button className="btn-secondary inline-flex items-center gap-2" onClick={load}>
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              ลองอีกครั้ง
            </button>
          </div>
        ) : !receipt ? (
          <LoadingState label="กำลังโหลดบิล..." />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-100 px-4 py-4 my-3">
              <div className="mx-auto w-fit max-w-full overflow-x-auto bg-white shadow-sm">
                <div ref={paperRef}>
                  <ReceiptPaper data={receipt} widthMm={paper} />
                </div>
              </div>
            </div>

            <div className="space-y-3 px-6 pb-5">
              <div className="flex items-center justify-between gap-3">
                <span id="paper-label" className="text-sm font-medium text-neutral-700">
                  ขนาดกระดาษ
                </span>
                <div role="group" aria-labelledby="paper-label" className="flex gap-1">
                  {PAPER_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={paper === size}
                      onClick={() => choosePaper(size)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        paper === size
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {size} มม.
                    </button>
                  ))}
                </div>
              </div>

              {actionError && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {actionError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-40"
                  onClick={handleSaveImage}
                  disabled={saving}
                  aria-busy={saving}
                >
                  {!saving && <ImageDown className="h-4 w-4" strokeWidth={2} />}
                  {saving ? "กำลังสร้างรูป..." : "บันทึกเป็นรูป"}
                </button>
                <button
                  type="button"
                  className="btn-primary inline-flex flex-1 items-center justify-center gap-2"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" strokeWidth={2} />
                  พิมพ์บิล
                </button>
              </div>
            </div>

            {createPortal(
              <div className="receipt-print-root">
                {pageHeightMm !== null && (
                  <style>{`@page { size: ${paper}mm ${pageHeightMm}mm; margin: 0; }`}</style>
                )}
                <ReceiptPaper data={receipt} widthMm={paper} />
              </div>,
              document.body
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReceiptPaper({ data, widthMm }: { data: ReceiptData; widthMm: number }) {
  return (
    <div
      className="bg-white p-[3mm] text-xs leading-snug text-black"
      style={{ width: `${widthMm}mm`, boxSizing: "border-box" }}
    >
      <div className="text-center">
        <p className="text-lg font-bold leading-tight">{data.shopName}</p>
        {data.branchName && <p>{data.branchName}</p>}
        {data.voided && <p className="mt-1 text-base font-bold">ยกเลิกแล้ว</p>}
        <p className="mt-1 font-semibold">บิล {data.billNo}</p>
        <p>{data.dateTime}</p>
        {data.tableName && <p>{data.tableName}</p>}
        {data.customerName && <p>ลูกค้า: {data.customerName}</p>}
      </div>

      <div className="my-2 border-t border-black" />

      <ul className="space-y-1.5">
        {data.lines.map((line, i) => (
          <li key={i}>
            <div className="flex justify-between gap-2 font-medium">
              <span className="min-w-0 [overflow-wrap:anywhere]">{line.name}</span>
              <span className="shrink-0">{line.total}</span>
            </div>
            <p>{line.detail}</p>
            {line.note && <p className="[overflow-wrap:anywhere]">หมายเหตุ: {line.note}</p>}
          </li>
        ))}
      </ul>

      <div className="my-2 border-t border-black" />

      <div className="space-y-0.5">
        <Row label="ยอดรวม" value={data.subtotal} />
        {data.discount && <Row label="ส่วนลด" value={data.discount} />}
        <div className="flex justify-between gap-2 py-1 text-base font-bold">
          <span>ยอดสุทธิ</span>
          <span>{data.total}</span>
        </div>
        <Row label="ชำระโดย" value={data.paymentMethod} />
        {data.received && <Row label="รับเงิน" value={data.received} />}
        {data.change && <Row label="เงินทอน" value={data.change} />}
        {data.note && <p className="pt-1 [overflow-wrap:anywhere]">หมายเหตุ: {data.note}</p>}
      </div>

      <div className="my-2 border-t border-black" />
      <p className="text-center">ขอบคุณที่ใช้บริการ</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
