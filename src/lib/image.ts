/** ย่อ/บีบอัดรูปฝั่ง client ก่อนอัปโหลด กันรูปจากกล้องมือถือ (มักหลาย MB) ทำให้โหลดช้า */
export async function compressImage(
  file: File,
  maxDimension = 1000,
  quality = 0.82
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context ไม่พร้อมใช้งาน");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("บีบอัดรูปไม่สำเร็จ");
  return blob;
}
