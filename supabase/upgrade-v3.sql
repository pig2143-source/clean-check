-- Clean Check v3 不需要新增資料表。
-- 本檔補強主管查閱 profiles 的索引，重複執行安全。
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists cleaning_tasks_active_sort_idx on public.cleaning_tasks(active,sort_order);
