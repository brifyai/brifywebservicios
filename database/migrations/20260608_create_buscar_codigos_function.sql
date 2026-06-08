create index if not exists idx_codigos_tsv_es
on public.codigos
using gin (
  to_tsvector(
    'spanish',
    coalesce(titulo, '') || ' ' || coalesce(contenido, '')
  )
);

create index if not exists idx_codigos_embedding
on public.codigos
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function public.buscar_codigos(
  termino_busqueda text,
  limite_resultados integer default 5
)
returns table (
  id uuid,
  titulo text,
  contenido text,
  file_path text,
  created_at timestamptz,
  relevancia double precision
)
language sql
stable
as $$
  with normalized as (
    select trim(coalesce(termino_busqueda, '')) as q
  ),
  ranked as (
    select
      c.id,
      c.titulo,
      c.contenido,
      c.file_path,
      c.created_at,
      greatest(
        case
          when (select q from normalized) = '' then 0::double precision
          else ts_rank_cd(
            to_tsvector('spanish', coalesce(c.titulo, '') || ' ' || coalesce(c.contenido, '')),
            websearch_to_tsquery('spanish', (select q from normalized))
          )::double precision
        end,
        case
          when coalesce(c.titulo, '') ilike '%' || (select q from normalized) || '%' then 0.95::double precision
          else 0::double precision
        end,
        case
          when coalesce(c.contenido, '') ilike '%' || (select q from normalized) || '%' then 0.75::double precision
          else 0::double precision
        end
      ) as relevancia
    from public.codigos c
    where
      (select q from normalized) <> ''
      and (
        coalesce(c.titulo, '') ilike '%' || (select q from normalized) || '%'
        or coalesce(c.contenido, '') ilike '%' || (select q from normalized) || '%'
        or to_tsvector('spanish', coalesce(c.titulo, '') || ' ' || coalesce(c.contenido, ''))
           @@ websearch_to_tsquery('spanish', (select q from normalized))
      )
  )
  select
    id,
    titulo,
    contenido,
    file_path,
    created_at,
    relevancia
  from ranked
  where relevancia > 0
  order by relevancia desc, created_at desc
  limit greatest(coalesce(limite_resultados, 5), 1);
$$;

comment on function public.buscar_codigos is
'Busqueda complementaria en material juridico de la tabla codigos usando titulo y contenido.';

create or replace function public.match_codigos(
  query_embedding vector(768),
  match_count integer default 5,
  min_similarity double precision default 0.7
)
returns table (
  id uuid,
  titulo text,
  contenido text,
  file_path text,
  created_at timestamptz,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id,
    c.titulo,
    c.contenido,
    c.file_path,
    c.created_at,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.codigos c
  where
    c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= greatest(coalesce(min_similarity, 0.7), 0)
  order by c.embedding <=> query_embedding
  limit greatest(coalesce(match_count, 5), 1);
$$;

comment on function public.match_codigos is
'Busqueda semantica en material juridico de la tabla codigos usando pgvector.';
