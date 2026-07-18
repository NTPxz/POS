-- ============================================================
-- Web Push: แจ้งเตือนพนักงานแม้ปิดหน้าจอ/สลับแอป/ปิดแท็บ
-- รันไฟล์นี้ใน Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================
create extension if not exists pg_net;

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
-- ไม่มี policy ให้ role ไหนเลย เข้าได้เฉพาะผ่าน security definer function เท่านั้น

-- แก้ push_trigger_secret ด้านล่างให้ตรงกับค่า PUSH_TRIGGER_SECRET ใน .env.local / Vercel ก่อนรัน
insert into public.app_settings (key, value) values
  ('push_notify_url', 'https://pos-peng-cage.vercel.app/api/push/notify'),
  ('push_trigger_secret', 'REPLACE_WITH_PUSH_TRIGGER_SECRET_FROM_ENV')
on conflict (key) do update set value = excluded.value;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

drop policy if exists "manage own push subscription" on public.push_subscriptions;
create policy "manage own push subscription" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.trigger_push_notify(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from app_settings where key = 'push_notify_url';
  select value into v_secret from app_settings where key = 'push_trigger_secret';
  if v_url is null or v_url = '' then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
  );
end;
$$;

create or replace function public.notify_push_on_customer_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_name text;
begin
  if new.ordered_by = 'customer' then
    select dt.name into v_table_name
      from sales s join dining_tables dt on dt.id = s.table_id
      where s.id = new.sale_id;
    perform public.trigger_push_notify(jsonb_build_object(
      'type', 'order',
      'table_name', coalesce(v_table_name, 'โต๊ะ'),
      'product_name', new.product_name,
      'quantity', new.quantity
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_push_customer_order on public.sale_items;
create trigger trg_push_customer_order
  after insert on public.sale_items
  for each row execute function public.notify_push_on_customer_order();

create or replace function public.notify_push_on_bill_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_name text;
begin
  if new.bill_requested_at is not null and old.bill_requested_at is null then
    select name into v_table_name from dining_tables where id = new.table_id;
    perform public.trigger_push_notify(jsonb_build_object(
      'type', 'bill',
      'table_name', coalesce(v_table_name, 'โต๊ะ')
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_push_bill_request on public.sales;
create trigger trg_push_bill_request
  after update on public.sales
  for each row execute function public.notify_push_on_bill_request();
