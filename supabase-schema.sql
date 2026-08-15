-- Supabase SQL：在 Supabase Dashboard -> SQL Editor 中一次性执行。
-- 前端只使用 anon public key；不要把 service_role key 放进 GitHub Pages。

create extension if not exists pgcrypto;

create table if not exists public.wechat_contents (
  content_id text primary key,
  content_json jsonb not null default '{}'::jsonb,
  share_key text not null,
  published boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.wechat_request_share_key()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-share-key',
    ''
  );
$$;

alter table public.wechat_contents enable row level security;

drop policy if exists "wechat contents public read published" on public.wechat_contents;
create policy "wechat contents public read published"
on public.wechat_contents for select to anon, authenticated
using (published = true or share_key = public.wechat_request_share_key());

drop policy if exists "wechat contents shared insert" on public.wechat_contents;
create policy "wechat contents shared insert"
on public.wechat_contents for insert to anon, authenticated
with check (share_key = public.wechat_request_share_key());

drop policy if exists "wechat contents shared update" on public.wechat_contents;
create policy "wechat contents shared update"
on public.wechat_contents for update to anon, authenticated
using (share_key = public.wechat_request_share_key())
with check (share_key = public.wechat_request_share_key());

insert into storage.buckets (id, name, public)
values ('wechat-recruitment-assets', 'wechat-recruitment-assets', true)
on conflict (id) do update set public = excluded.public;

-- storage.objects 由 Supabase Storage 自动启用 RLS；普通项目成员不能再次 ALTER 该系统表。

drop policy if exists "wechat assets public read" on storage.objects;
create policy "wechat assets public read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'wechat-recruitment-assets');

drop policy if exists "wechat assets shared upload" on storage.objects;
create policy "wechat assets shared upload"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'wechat-recruitment-assets'
  and split_part(name, '/', 2) = public.wechat_request_share_key()
);

drop policy if exists "wechat assets shared update" on storage.objects;
create policy "wechat assets shared update"
on storage.objects for update to anon, authenticated
using (
  bucket_id = 'wechat-recruitment-assets'
  and split_part(name, '/', 2) = public.wechat_request_share_key()
)
with check (
  bucket_id = 'wechat-recruitment-assets'
  and split_part(name, '/', 2) = public.wechat_request_share_key()
);
