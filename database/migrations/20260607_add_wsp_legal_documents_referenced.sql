alter table public.wsp_legal_threads
add column if not exists documents_referenced jsonb not null default '[]'::jsonb;

update public.wsp_legal_threads
set documents_referenced = '[]'::jsonb
where documents_referenced is null;
