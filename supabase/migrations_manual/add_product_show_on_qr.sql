-- ============================================================
-- สินค้าเลือกได้ว่าจะโชว์ในเมนูที่ลูกค้าสแกน QR สั่งหรือไม่ (ค่าเริ่มต้นคือโชว์)
-- ใช้กับ schema public แล้วใช้ซ้ำกับ schema ของร้านอื่น (เช่น rompho)
-- ============================================================
alter table public.products add column if not exists show_on_qr boolean not null default true;

-- public.public_menu: เพิ่มเงื่อนไขท้าย WHERE ของ view เดิม
--   WHERE is_active = true AND is_sold_out = false AND show_on_qr = true

-- public.customer_add_order: เพิ่มเงื่อนไขตอนเลือกสินค้า เพื่อกันการสั่งจากหน้าเมนูที่เปิดค้างไว้
--   where id = (v_item ->> 'product_id')::uuid and is_active = true and show_on_qr = true
