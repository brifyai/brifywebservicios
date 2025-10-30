-- Script simplificado para configurar búsqueda híbrida solo en documentos_entrenador
-- Este script elimina la dependencia de file_embeddings y usa solo documentos_entrenador
-- Ejecutar en Supabase SQL Editor

-- 1. Crear índices optimizados para documentos_entrenador
CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_embedding 
ON documentos_entrenador USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_metadata_file_id 
ON documentos_entrenador USING gin ((metadata->>'file_id'));

CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_metadata_chunk_type 
ON documentos_entrenador USING gin ((metadata->>'chunk_type'));

CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_entrenador 
ON documentos_entrenador (entrenador);

-- 2. Crear o actualizar función match_documentos_entrenador
CREATE OR REPLACE FUNCTION match_documentos_entrenador(
  query_embedding vector(768),
  filter jsonb DEFAULT '{}',
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documentos_entrenador.id,
    documentos_entrenador.content,
    documentos_entrenador.metadata,
    1 - (documentos_entrenador.embedding <=> query_embedding) as similarity
  FROM
    documentos_entrenador
  WHERE
    documentos_entrenador.embedding IS NOT NULL
    -- Filtros opcionales (descomenta si necesitas filtrar por metadata)
    -- AND documentos_entrenador.metadata @> filter
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- 3. Crear tabla user_tokens_usage si no existe (para tracking de tokens)
CREATE TABLE IF NOT EXISTS user_tokens_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  operation_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear índices para user_tokens_usage
CREATE INDEX IF NOT EXISTS idx_user_tokens_usage_user_id ON user_tokens_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_usage_created_at ON user_tokens_usage(created_at);

-- 5. Habilitar RLS en user_tokens_usage
ALTER TABLE user_tokens_usage ENABLE ROW LEVEL SECURITY;

-- 6. Crear política RLS para user_tokens_usage
CREATE POLICY "Users can view their own token usage" ON user_tokens_usage
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own token usage" ON user_tokens_usage
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 7. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Crear trigger para actualizar updated_at en user_tokens_usage
DROP TRIGGER IF EXISTS update_user_tokens_usage_updated_at ON user_tokens_usage;
CREATE TRIGGER update_user_tokens_usage_updated_at
    BEFORE UPDATE ON user_tokens_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Verificar configuración
SELECT 'Configuración completada para documentos_entrenador' as status;

-- 10. Verificar índices creados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'documentos_entrenador' 
AND schemaname = 'public'
ORDER BY indexname;

-- 11. Verificar función creada
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'match_documentos_entrenador';

-- 12. Ejemplo de uso de la función
/*
-- Para probar la función (descomenta y ajusta el embedding de prueba):
SELECT * FROM match_documentos_entrenador(
  array_fill(0.1, ARRAY[768])::vector,  -- Embedding de prueba
  '{}'::jsonb,                          -- Sin filtros
  5                                     -- Máximo 5 resultados
);
*/

-- 13. Información sobre el sistema de chunks
SELECT 
    'Sistema configurado para chunks en documentos_entrenador' as info,
    'Los documentos largos se dividen en chunks con metadata.chunk_type = "chunk"' as chunk_info,
    'Los documentos principales tienen metadata.chunk_type = "main"' as main_info;