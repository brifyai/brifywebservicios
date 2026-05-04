-- Función para buscar embeddings similares en file_embeddings
-- Esta función calcula la similitud coseno entre el embedding de consulta y los embeddings almacenados
-- Estructura similar a match_documentos_entrenador para compatibilidad

CREATE OR REPLACE FUNCTION match_file_embeddings(
  query_embedding vector(768),
  filter jsonb DEFAULT '{}',
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  file_id text,
  chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fe.id,
    fe.content,
    jsonb_build_object(
      'file_name', COALESCE(de.metadata->>'file_name', 'Documento sin nombre'),
      'file_id', fe.file_id,
      'chunk_index', fe.chunk_index,
      'source', 'chunk'
    ) as metadata,
    1 - (fe.embedding <=> query_embedding) as similarity,
    fe.file_id,
    fe.chunk_index
  FROM file_embeddings fe
  INNER JOIN documentos_entrenador de ON fe.file_id = de.metadata->>'file_id'
  -- Aquí es donde se aplicarían los filtros si los usaras en el futuro
  -- WHERE de.metadata @> filter -- Descomenta esta línea si empiezas a usar filtros de metadata
  ORDER BY 
    similarity DESC
  LIMIT 
    match_count;
END;
$$;

-- Crear índice para mejorar el rendimiento de las búsquedas
CREATE INDEX IF NOT EXISTS idx_file_embeddings_embedding 
ON file_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Crear índice en file_id para joins más rápidos
CREATE INDEX IF NOT EXISTS idx_file_embeddings_file_id 
ON file_embeddings (file_id);

-- Crear índice en metadata->>'file_id' para joins más rápidos
CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_file_id 
ON documentos_entrenador USING gin ((metadata->>'file_id'));