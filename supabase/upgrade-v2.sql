-- Clean Check v2 升級腳本
-- 目前已成功執行 schema.sql 的專案，可執行本檔。內容可重複執行。

create index if not exists cleaning_submissions_work_date_idx
  on public.cleaning_submissions(work_date desc);
create index if not exists cleaning_submissions_status_idx
  on public.cleaning_submissions(status);
create index if not exists cleaning_submissions_staff_idx
  on public.cleaning_submissions(staff_id);
create index if not exists cleaning_tasks_sort_idx
  on public.cleaning_tasks(sort_order);

-- 允許本人更新自己當日的紀錄，以支援重新拍照與主管帳號執行清潔。
drop policy if exists "staff update own redo" on public.cleaning_submissions;
create policy "staff update own submission" on public.cleaning_submissions
for update to authenticated
using (staff_id = auth.uid())
with check (staff_id = auth.uid());

-- 允許使用者刪除自己尚未核准的照片物件，主管可刪除全部。
drop policy if exists "photos delete own or manager" on storage.objects;
create policy "photos delete own or manager" on storage.objects
for delete to authenticated
using (
  bucket_id = 'cleaning-photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
);
