-- Clean Check v4：報表查詢效能索引，可重複執行。
create index if not exists cleaning_submissions_work_date_idx
  on public.cleaning_submissions(work_date desc);
create index if not exists cleaning_submissions_staff_date_idx
  on public.cleaning_submissions(staff_id, work_date desc);
create index if not exists cleaning_submissions_task_date_idx
  on public.cleaning_submissions(task_id, work_date desc);
create index if not exists cleaning_submissions_status_date_idx
  on public.cleaning_submissions(status, work_date desc);
