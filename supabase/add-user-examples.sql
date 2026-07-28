-- 請把 UUID 換成 Authentication > Users 顯示的 User UID。

-- 新增主管
insert into public.profiles (id, display_name, role)
values ('AUTH_USER_UUID', '李店長', 'manager')
on conflict (id) do update
set display_name = excluded.display_name,
    role = excluded.role;

-- 新增員工範例
-- insert into public.profiles (id, display_name, role)
-- values ('AUTH_USER_UUID', '小明', 'staff')
-- on conflict (id) do update
-- set display_name = excluded.display_name,
--     role = excluded.role;
