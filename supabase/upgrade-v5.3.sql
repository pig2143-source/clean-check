-- DP Clean v5.3 / Sprint 3：清潔項目管理升級
-- 請在 Supabase Dashboard > SQL Editor 執行一次。

alter table public.cleaning_tasks
  add column if not exists frequency text not null default 'daily'
    check (frequency in ('daily','weekly','monthly','custom')),
  add column if not exists deadline_time time,
  add column if not exists photo_required boolean not null default true,
  add column if not exists min_photos integer not null default 1 check (min_photos between 1 and 10),
  add column if not exists photo_angles text not null default '',
  add column if not exists instructions text not null default '',
  add column if not exists assigned_role text not null default 'staff'
    check (assigned_role in ('staff','manager','all')),
  add column if not exists assigned_staff_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists cleaning_tasks_assigned_staff_idx
  on public.cleaning_tasks(assigned_staff_id);

create index if not exists cleaning_tasks_active_sort_idx
  on public.cleaning_tasks(active, sort_order);

update public.cleaning_tasks
set frequency = case
  when schedule_label like '%每週%' then 'weekly'
  when schedule_label like '%每月%' then 'monthly'
  else 'daily'
end
where frequency = 'daily';
