-- 在 Supabase Dashboard > SQL Editor 貼上並執行本檔。

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'staff' check (role in ('staff','manager')),
  created_at timestamptz not null default now()
);

create table if not exists public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  schedule_label text not null default '每日',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cleaning_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.cleaning_tasks(id) on delete cascade,
  work_date date not null default current_date,
  staff_id uuid not null references public.profiles(id),
  photo_path text not null,
  note text not null default '',
  status text not null default 'review' check (status in ('review','approved','redo')),
  manager_note text not null default '',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(task_id, work_date)
);

alter table public.profiles enable row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.cleaning_submissions enable row level security;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'manager'); $$;

create policy "profiles read authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles update self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "tasks read authenticated" on public.cleaning_tasks for select to authenticated using (active = true or public.is_manager());
create policy "tasks manager insert" on public.cleaning_tasks for insert to authenticated with check (public.is_manager());
create policy "tasks manager update" on public.cleaning_tasks for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "tasks manager delete" on public.cleaning_tasks for delete to authenticated using (public.is_manager());

create policy "submissions read authenticated" on public.cleaning_submissions for select to authenticated using (true);
create policy "staff submit own" on public.cleaning_submissions for insert to authenticated with check (staff_id = auth.uid());
create policy "staff update own redo" on public.cleaning_submissions for update to authenticated
  using (staff_id = auth.uid() and status = 'redo')
  with check (staff_id = auth.uid() and status = 'review');
create policy "manager review" on public.cleaning_submissions for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

insert into storage.buckets (id, name, public)
values ('cleaning-photos','cleaning-photos',false)
on conflict (id) do nothing;

create policy "photos read authenticated" on storage.objects for select to authenticated
using (bucket_id = 'cleaning-photos');
create policy "photos upload own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'cleaning-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos manager delete" on storage.objects for delete to authenticated
using (bucket_id = 'cleaning-photos' and public.is_manager());

insert into public.cleaning_tasks (name,area,schedule_label,sort_order)
select * from (values
 ('鐵板清潔','廚房','打烊後',1),
 ('地板拖洗','用餐區','打烊後',2),
 ('冰箱整理','廚房','每日',3),
 ('廁所清潔','廁所','每日三次',4),
 ('排水溝清潔','廚房','打烊後',5),
 ('垃圾桶清潔','全店','打烊後',6)
) as seed(name,area,schedule_label,sort_order)
where not exists (select 1 from public.cleaning_tasks);

-- 建立 Auth 使用者後，請用實際 UUID 新增 profile：
-- insert into public.profiles (id, display_name, role) values
-- ('員工的 auth.users UUID','小明','staff'),
-- ('主管的 auth.users UUID','店長','manager');
