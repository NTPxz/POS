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
  v_allowed text[];
begin
  if coalesce(v_claims->>'role', '') <> 'authenticated' then
    return;
  end if;

  -- app_metadata ตั้งได้จาก service role เท่านั้น: shops = บัญชีที่เข้าได้หลายร้าน, shop = ร้านเดียว
  if jsonb_typeof(v_claims->'app_metadata'->'shops') = 'array' then
    v_allowed := array(select jsonb_array_elements_text(v_claims->'app_metadata'->'shops'));
  elsif v_claims->'app_metadata'->>'shop' = 'rompho' then
    v_allowed := array['rompho'];
  else
    v_allowed := array['public'];
  end if;

  -- ไม่ส่ง header ทั้งคู่ = PostgREST ใช้ schema ดีฟอลต์คือ public
  if coalesce(v_headers->>'accept-profile', v_headers->>'content-profile', 'public') <> all (v_allowed)
     or coalesce(v_headers->>'accept-profile', v_allowed[1]) <> all (v_allowed)
     or coalesce(v_headers->>'content-profile', v_allowed[1]) <> all (v_allowed) then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลของร้านนี้'
      using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.check_shop_access() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.check_shop_access';
notify pgrst, 'reload config';

-- GoTrue ใส่ app_metadata ด้วย UPDATE หลัง INSERT ลง auth.users จึงต้องย้าย profile ตอนนั้น
create or replace function public.handle_user_shop_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.activity_log where table_name = 'profiles' and record_id::text = new.id::text;
  delete from public.profiles where id = new.id;

  insert into rompho.profiles (id, email, role, branch_id)
  values (
    new.id,
    new.email,
    case when exists (select 1 from rompho.profiles) then 'staff' else 'owner' end,
    (select id from rompho.branches where position = 1)
  )
  on conflict (id) do nothing;

  delete from public.activity_log where table_name = 'profiles' and record_id::text = new.id::text;
  return new;
end;
$$;

revoke all on function public.handle_user_shop_assigned() from public, anon, authenticated;

drop trigger if exists on_auth_user_shop_assigned on auth.users;
create trigger on_auth_user_shop_assigned
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data->>'shop' = 'rompho'
        and old.raw_app_meta_data->>'shop' is distinct from 'rompho')
  execute function public.handle_user_shop_assigned();
