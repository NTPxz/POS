const bahtFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function baht(n: number): string {
  return `฿${bahtFormatter.format(n)}`;
}

export function formatNumber(n: number): string {
  return bahtFormatter.format(n);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function billNumber(n: number): string {
  return `#${String(n).padStart(6, "0")}`;
}

/** คืนค่า ISO string ของเวลาเที่ยงคืน (เวลาท้องถิ่น) ของวันที่กำหนด */
export function startOfDayISO(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** แปลงเป็น "YYYY-MM-DD" (เวลาท้องถิ่น) สำหรับใช้กับ input type="date" */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
