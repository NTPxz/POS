# 🛒 POS — ระบบขายหน้าร้าน

ระบบ Point of Sale ครบวงจร ใช้งานง่าย รองรับทั้ง **มือถือ / iPad / PC** (responsive)
สร้างด้วย **Next.js + Tailwind CSS + Supabase** พร้อม deploy บน **Vercel** ได้ทันที

## ✨ ฟีเจอร์

- **ขายหน้าร้าน (POS)** — เลือกสินค้าจากตาราง, ค้นหา/สแกนบาร์โค้ด, กรองตามหมวดหมู่, ตะกร้าสินค้า, ส่วนลด, ชำระด้วยเงินสด/โอน/บัตร, คำนวณเงินทอนอัตโนมัติ
- **บันทึกยอดขาย** — ทุกบิลถูกบันทึกพร้อมรายการสินค้า ราคา และต้นทุน ณ เวลาขาย, ดูประวัติย้อนหลังตามช่วงวันที่, ยกเลิกบิล (คืนสต๊อกอัตโนมัติ)
- **บันทึกต้นทุน & กำไร** — กำหนดต้นทุนต่อชิ้นของสินค้า ระบบคำนวณกำไรต่อชิ้น กำไรต่อบิล และกำไรรวมให้อัตโนมัติ
- **จัดการสินค้า & สต๊อก** — เพิ่ม/แก้ไข/ลบสินค้า, หมวดหมู่, บาร์โค้ด, ตัดสต๊อกอัตโนมัติเมื่อขาย, แจ้งเตือนสินค้าใกล้หมด
- **Dashboard ภาพรวมร้าน** — ยอดขาย ต้นทุน กำไร จำนวนบิล, กราฟยอดขายรายวัน, สินค้าขายดี Top 5, แยกยอดตามวิธีชำระเงิน (วันนี้ / 7 วัน / 30 วัน / เดือนนี้)
- **ระบบล็อกอิน** — ผ่าน Supabase Auth ปลอดภัยด้วย Row Level Security

## 🧰 Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS (responsive: mobile / tablet / desktop) |
| Database + Auth | Supabase (PostgreSQL + Row Level Security) |
| Hosting | Vercel |

## 🚀 วิธีติดตั้ง

### 1. สร้างโปรเจกต์ Supabase

1. ไปที่ [supabase.com](https://supabase.com) → **New Project**
2. เมื่อสร้างเสร็จ ไปที่ **SQL Editor** → วางเนื้อหาทั้งหมดจากไฟล์ [`supabase/schema.sql`](supabase/schema.sql) → กด **Run**
3. ไปที่ **Authentication → Users → Add user** → สร้างบัญชีพนักงาน (อีเมล + รหัสผ่าน) — แนะนำติ๊ก *Auto Confirm User*
4. ไปที่ **Settings → API** จด 2 ค่านี้ไว้:
   - `Project URL`
   - `anon public` key

### 2. รันบนเครื่อง (local)

```bash
git clone https://github.com/NTPxz/POS.git
cd POS
npm install
cp .env.example .env.local   # แล้วแก้ไขใส่ค่าจาก Supabase
npm run dev
```

เปิด http://localhost:3000 แล้วล็อกอินด้วยบัญชีที่สร้างไว้

### 3. Deploy ขึ้น Vercel

1. ไปที่ [vercel.com](https://vercel.com) → **Add New Project** → เลือก repo `NTPxz/POS`
2. ที่หน้า config ใส่ **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL ของ Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key ของ Supabase
3. กด **Deploy** — เสร็จแล้ว! เปิดใช้ได้จากมือถือ / iPad / PC ได้เลย

> 💡 เปิดจากมือถือแล้วกด "Add to Home Screen" จะใช้งานได้เหมือนแอปเลย

## 📁 โครงสร้างโปรเจกต์

```
supabase/schema.sql        # SQL สร้างตาราง + ฟังก์ชัน + RLS (รันครั้งเดียวตอนติดตั้ง)
src/
  middleware.ts            # ตรวจสอบล็อกอินทุกหน้า
  lib/
    supabase/              # Supabase client (browser + server)
    types.ts               # Type ของข้อมูลทั้งหมด
    format.ts              # ฟังก์ชันจัดรูปแบบเงิน/วันที่
  components/AppShell.tsx  # Sidebar (desktop) + Bottom nav (mobile)
  app/
    login/                 # หน้าล็อกอิน
    (app)/
      page.tsx             # 🛒 หน้าขายสินค้า (POS)
      dashboard/           # 📊 ภาพรวมร้าน ยอดขาย/ต้นทุน/กำไร
      sales/               # 🧾 ประวัติการขาย + ยกเลิกบิล
      products/            # 📦 จัดการสินค้า หมวดหมู่ สต๊อก
```

## 🗄️ โครงสร้างฐานข้อมูล

- `categories` — หมวดหมู่สินค้า
- `products` — สินค้า (ราคาขาย, ต้นทุน, สต๊อก, บาร์โค้ด)
- `sales` — บิลขาย (ยอดรวม, ส่วนลด, ต้นทุนรวม, วิธีชำระ, เงินรับ/ทอน, สถานะ)
- `sale_items` — รายการสินค้าในบิล (บันทึกราคาและต้นทุน ณ เวลาขาย)
- ฟังก์ชัน `create_sale()` — บันทึกบิล + ตัดสต๊อกใน transaction เดียว (กันข้อมูลเพี้ยน)
- ฟังก์ชัน `void_sale()` — ยกเลิกบิล + คืนสต๊อก
