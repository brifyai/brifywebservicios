-- Función para buscar contenido similar en documentos_administrador usando pgvector
-- Aplica filtro por administrador (email) y servicio = 'abogados'

CREATE OR REPLACE FUNCTION match_documentos_administrador(
  query_embedding vector(768),
  match_count int DEFAULT 10,
  administrador text DEFAULT NULL,
  servicio text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  name text,
  file_type text,
  file_id text,
  telegram_id text,
  administrador text,
  created_at timestamp with time zone,
  metadata jsonb,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    da.id,
    da.name,
    da.file_type,
    da.file_id,
    da.telegram_id,
    da.administrador,
    da.created_at,
    da.metadata,
    da.content,
    1 - (da.embedding <=> query_embedding) AS similarity
  FROM public.documentos_administrador AS da
  WHERE 1 - (da.embedding <=> query_embedding) > 0.7
    AND (administrador IS NULL OR da.administrador = administrador)
    AND (servicio IS NULL OR da.servicio = servicio)
  ORDER BY da.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Índice para acelerar búsquedas vectoriales si no existe
CREATE INDEX IF NOT EXISTS idx_documentos_administrador_embedding
ON documentos_administrador USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMENT ON FUNCTION match_documentos_administrador IS 'Búsqueda semántica en documentos_administrador con umbral 0.7 y filtros por administrador y servicio';