-- ============================================================
-- ปิดการเข้าถึงข้ามร้านระหว่างหม่าล่า เป่ง (public) กับร่มโพธิ์ (rompho)
-- รันไฟล์นี้ใน Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- ถ้า POS ใช้งานไม่ได้หลังรัน ให้ปิดตัวเช็กด้วย:
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';
-- ============================================================

-- รูปสินค้าของหม่าล่า เป่ง: เขียนได้เฉพาะคนที่มี profile ใน public
alter policy "authenticated upload product images" on storage.objects
  with check (bucket_id = 'product-images' and public.my_role() is not null);
alter policy "authenticated update product images" on storage.objects
  using (bucket_id = 'product-images' and public.my_role() is not null)
  with check (bucket_id = 'product-images' and public.my_role() is not null);
alter policy "authenticated delete product images" on storage.objects
  using (bucket_id = 'product-images' and public.my_role() is not null);

-- ทำงานก่อนทุกคำขอของ PostgREST: บัญชีเรียกได้เฉพาะ schema ของร้านตัวเอง
create or replace function public.check_shop_access()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_allowed text;
begin
  if coalesce(v_claims->>'role', '') <> 'authenticated' then
    return;
  end if;

  v_allowed := case when v_claims->'app_metadata'->>'shop' = 'rompho' then 'rompho' else 'public' end;

  -- ไม่ส่ง header ทั้งคู่ = PostgREST ใช้ schema ดีฟอลต์คือ public
  if coalesce(v_headers->>'accept-profile', v_headers->>'content-profile', 'public') <> v_allowed
     or coalesce(v_headers->>'accept-profile', v_allowed) <> v_allowed
     or coalesce(v_headers->>'content-profile', v_allowed) <> v_allowed then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลของร้านนี้'
      using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.check_shop_access() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.check_shop_access';
notify pgrst, 'reload config';
