import { Loader2 } from "lucide-react";

/**
 * ใช้จุดเดียวทุกหน้า ทั้งตอนเปลี่ยนหน้าและตอนโหลดข้อมูล ตำแหน่งจึงไม่กระโดดระหว่างสองช่วงนี้
 * หน่วงการแสดงเล็กน้อย (.loading-state) เพื่อไม่ให้กะพริบเวลาข้อมูลมาเร็ว
 */
export default function LoadingState({ label = "กำลังโหลด..." }: { label?: string }) {
  return (
    <div
      role="status"
      className="loading-state flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm text-neutral-600"
    >
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" strokeWidth={2} aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
