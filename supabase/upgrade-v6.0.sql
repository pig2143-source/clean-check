-- DP Clean v6.0 AI 照片分析欄位
alter table public.cleaning_submissions add column if not exists ai_status text default 'pending' check (ai_status in ('pending','analyzing','completed','failed'));
alter table public.cleaning_submissions add column if not exists ai_score integer check (ai_score between 0 and 100);
alter table public.cleaning_submissions add column if not exists ai_verdict text check (ai_verdict in ('pass','review','fail'));
alter table public.cleaning_submissions add column if not exists ai_oil_stain jsonb;
alter table public.cleaning_submissions add column if not exists ai_water_stain jsonb;
alter table public.cleaning_submissions add column if not exists ai_trash jsonb;
alter table public.cleaning_submissions add column if not exists ai_summary text;
alter table public.cleaning_submissions add column if not exists ai_suggestions jsonb default '[]'::jsonb;
alter table public.cleaning_submissions add column if not exists ai_image_quality text check (ai_image_quality in ('good','usable','poor'));
alter table public.cleaning_submissions add column if not exists ai_model text;
alter table public.cleaning_submissions add column if not exists ai_analyzed_at timestamptz;
alter table public.cleaning_submissions add column if not exists ai_error text;
create index if not exists cleaning_submissions_ai_status_idx on public.cleaning_submissions(ai_status);
