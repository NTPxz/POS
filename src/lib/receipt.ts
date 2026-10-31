import { baht, billNumber, formatDateTime, formatNumber } from "@/lib/format";
import type { Shop } from "@/lib/shops";
import { PAYMENT_LABELS, SaleWithItems } from "@/lib/types";

export type ReceiptSale = SaleWithItems & {
  dining_tables: { name: string } | null;
};

export type ReceiptLine = {
  name: string;
  detail: string;
  total: string;
  note: string | null;
};

export type ReceiptData = {
  shopName: string;
  branchName: string | null;
  logo: string | null;
  footer: string[];
  billNo: string;
  dateTime: string;
  tableName: string | null;
  customerName: string | null;
  voided: boolean;
  lines: ReceiptLine[];
  subtotal: string;
  discount: string | null;
  total: string;
  paymentMethod: string;
  received: string | null;
  change: string | null;
  note: string | null;
};

export function buildReceipt(
  sale: ReceiptSale,
  shop: Shop,
  branchName: string | null
): ReceiptData {
  const items = [...sale.sale_items].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  return {
    shopName: shop.receiptName,
    branchName,
    logo: shop.receiptLogo,
    footer: shop.receiptFooter,
    billNo: billNumber(sale.sale_number),
    dateTime: formatDateTime(sale.created_at),
    tableName: sale.dining_tables?.name ?? null,
    customerName: sale.customer_name,
    voided: sale.status === "voided",
    lines: items.map((item) => ({
      name: item.product_name,
      detail: `${formatNumber(Number(item.quantity))} x ${baht(Number(item.price))}`,
      total: baht(Number(item.total)),
      note: item.note,
    })),
    subtotal: baht(Number(sale.subtotal)),
    discount: Number(sale.discount) > 0 ? `-${baht(Number(sale.discount))}` : null,
    total: baht(Number(sale.total)),
    paymentMethod: PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method,
    received: sale.received !== null ? baht(Number(sale.received)) : null,
    change: sale.received !== null ? baht(Number(sale.change ?? 0)) : null,
    note: sale.note,
  };
}

// 576px = ความกว้างพิมพ์จริงของเครื่องพิมพ์ความร้อน 80mm ที่ 203dpi รูปจึงสั่งพิมพ์ต่อได้คมชัด
const IMAGE_WIDTH = 576;
const PADDING = 28;
const FONT = "'Noto Sans Thai', sans-serif";

/** ตัดบรรทัดตามคำ ภาษาไทยไม่มีเว้นวรรคจึงต้องใช้ Intl.Segmenter แทนการแบ่งด้วยช่องว่าง */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const split = (value: string, granularity: "word" | "grapheme"): string[] =>
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter("th", { granularity }).segment(value),
          (s) => s.segment
        )
      : Array.from(value);

  const lines: string[] = [];
  let line = "";
  const push = (piece: string) => {
    if (line && ctx.measureText(line + piece).width > maxWidth) {
      lines.push(line.trimEnd());
      line = piece.trimStart();
    } else {
      line += piece;
    }
  };
  for (const word of split(text, "word")) {
    if (ctx.measureText(word).width > maxWidth) {
      split(word, "grapheme").forEach(push);
    } else {
      push(word);
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

/** วาดบิลทั้งใบ คืนค่าความสูงที่ใช้ เรียกสองรอบ: รอบแรกวัดความสูง รอบสองวาดจริง */
function drawReceipt(
  ctx: CanvasRenderingContext2D,
  data: ReceiptData,
  logo: HTMLImageElement | null
): number {
  const contentWidth = IMAGE_WIDTH - PADDING * 2;
  const right = IMAGE_WIDTH - PADDING;
  let y = PADDING;

  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  // บาง iPhone ไม่สนใจ ctx.textAlign ทำให้ข้อความกึ่งกลางเยื้องและยอดเงินล้นขอบขวา
  // จึงวาดชิดซ้ายเสมอแล้วคำนวณตำแหน่งจากความกว้างข้อความเอง
  ctx.textAlign = "left";

  const center = (text: string, size: number, weight = 400) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    for (const line of wrapText(ctx, text, contentWidth)) {
      ctx.fillText(line, (IMAGE_WIDTH - ctx.measureText(line).width) / 2, y);
      y += size * 1.45;
    }
  };

  const row = (label: string, value: string, size = 24, weight = 400) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const valueWidth = ctx.measureText(value).width;
    ctx.fillText(value, right - valueWidth, y);
    const labelLines = wrapText(ctx, label, contentWidth - valueWidth - 16);
    labelLines.forEach((line, i) => {
      ctx.fillText(line, PADDING, y + i * size * 1.45);
    });
    y += Math.max(labelLines.length, 1) * size * 1.45;
  };

  const divider = () => {
    y += 10;
    ctx.fillRect(PADDING, y, contentWidth, 2);
    y += 14;
  };

  center(data.shopName, 38, 700);
  if (data.branchName) center(data.branchName, 24);
  y += 6;
  if (data.voided) center("ยกเลิกแล้ว", 32, 700);
  if (logo) {
    const size = 200;
    ctx.drawImage(logo, (IMAGE_WIDTH - size) / 2, y, size, size);
    y += size + 10;
  } else {
    center(`บิล ${data.billNo}`, 24, 600);
  }
  center(data.dateTime, 22);
  if (data.tableName) center(data.tableName, 24);
  if (data.customerName) center(`ลูกค้า: ${data.customerName}`, 24);
  divider();

  for (const line of data.lines) {
    row(line.name, line.total, 24, 500);
    ctx.font = `400 21px ${FONT}`;
    ctx.fillText(line.detail, PADDING, y);
    y += 30;
    if (line.note) {
      for (const text of wrapText(ctx, `หมายเหตุ: ${line.note}`, contentWidth)) {
        ctx.fillText(text, PADDING, y);
        y += 30;
      }
    }
    y += 6;
  }
  divider();

  row("ยอดรวม", data.subtotal);
  if (data.discount) row("ส่วนลด", data.discount);
  y += 4;
  row("ยอดสุทธิ", data.total, 34, 700);
  y += 4;
  row("ชำระโดย", data.paymentMethod);
  if (data.received) row("รับเงิน", data.received);
  if (data.change) row("เงินทอน", data.change);
  if (data.note) {
    ctx.font = `400 22px ${FONT}`;
    for (const text of wrapText(ctx, `หมายเหตุ: ${data.note}`, contentWidth)) {
      ctx.fillText(text, PADDING, y);
      y += 32;
    }
  }
  divider();
  data.footer.forEach((line) => center(line, 24));

  return Math.ceil(y + PADDING);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("โหลดโลโก้บนบิลไม่สำเร็จ"));
    image.src = src;
  });
}

export async function renderReceiptImage(data: ReceiptData): Promise<Blob> {
  // canvas ไม่รอฟอนต์ให้เอง ถ้าฟอนต์ยังไม่โหลดจะได้รูปที่ใช้ฟอนต์สำรอง
  await Promise.all(
    [400, 500, 600, 700].map((weight) =>
      document.fonts.load(`${weight} 24px 'Noto Sans Thai'`, "กขค")
    )
  );

  const logo = data.logo ? await loadImage(data.logo) : null;

  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้สร้างรูปไม่ได้");

  const height = drawReceipt(ctx, data, logo);
  canvas.height = height; // การตั้งขนาดจะล้าง canvas และ state ทั้งหมด
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, IMAGE_WIDTH, height);
  drawReceipt(ctx, data, logo);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("สร้างรูปไม่สำเร็จ"))),
      "image/png"
    );
  });
}
