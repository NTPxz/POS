// สคริปต์รันครั้งเดียว: ย่อ/บีบอัดรูปสินค้าที่อัปโหลดไว้แล้วในตอนก่อนที่ระบบจะย่อรูปให้อัตโนมัติ
// ใช้: node --env-file=.env.local scripts/optimize-existing-images.mjs
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("ต้องตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อน (.env.local)");
  process.exit(1);
}

const BUCKET = "product-images";
const MAX_DIMENSION = 1000;
const QUALITY = 82;

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: objects, error: listErr } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  if (listErr) {
    console.error("ดึงรายการไฟล์ไม่สำเร็จ:", listErr.message);
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;
  let skipped = 0;

  for (const obj of objects ?? []) {
    if (!obj.name || obj.id === null) continue; // ข้าม "โฟลเดอร์"

    const { data: blob, error: downloadErr } = await supabase.storage.from(BUCKET).download(obj.name);
    if (downloadErr || !blob) {
      console.warn(`ข้าม ${obj.name}: ดาวน์โหลดไม่สำเร็จ (${downloadErr?.message})`);
      skipped += 1;
      continue;
    }

    const beforeBuf = Buffer.from(await blob.arrayBuffer());
    const beforeSize = beforeBuf.length;

    let afterBuf;
    try {
      afterBuf = await sharp(beforeBuf)
        .rotate() // เคารพ EXIF orientation ก่อนย่อ
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALITY })
        .toBuffer();
    } catch (err) {
      console.warn(`ข้าม ${obj.name}: แปลงรูปไม่สำเร็จ (${err.message})`);
      skipped += 1;
      continue;
    }

    // ถ้าย่อแล้วไม่ได้เล็กลงจริง (เช่นไฟล์เล็กอยู่แล้ว) ก็ไม่ต้องอัปใหม่
    if (afterBuf.length >= beforeSize) {
      console.log(`ข้าม ${obj.name}: ขนาดเดิมเล็กกว่าอยู่แล้ว (${beforeSize} bytes)`);
      totalBefore += beforeSize;
      totalAfter += beforeSize;
      continue;
    }

    const { error: uploadErr } = await supabase.storage.from(BUCKET).update(obj.name, afterBuf, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
    if (uploadErr) {
      console.warn(`ข้าม ${obj.name}: อัปโหลดใหม่ไม่สำเร็จ (${uploadErr.message})`);
      skipped += 1;
      continue;
    }

    totalBefore += beforeSize;
    totalAfter += afterBuf.length;
    processed += 1;
    console.log(
      `✓ ${obj.name}: ${(beforeSize / 1024).toFixed(0)}KB → ${(afterBuf.length / 1024).toFixed(0)}KB`
    );
  }

  console.log("");
  console.log(`เสร็จแล้ว: ย่อ ${processed} ไฟล์, ข้าม ${skipped} ไฟล์`);
  console.log(
    `ขนาดรวม: ${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`
  );
}

main();
