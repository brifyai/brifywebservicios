-- Script completo para configurar el sistema de chunking y búsqueda híbrida
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla file_embeddings si no existe
CREATE TABLE IF NOT EXISTS file_embeddings (
  id BIGSERIAL PRIMARY KEY,
  file_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_file_embeddings_file_id ON file_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_embedding ON file_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_embedding ON documentos_entrenador USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_metadata_file_id ON documentos_entrenador USING gin ((metadata->>'file_id'));

-- 3. Crear función match_documentos_entrenador
CREATE OR REPLACE FUNCTION match_documentos_entrenador(
  query_embedding vector(768),
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
  -- Aquí es donde se aplicarían los filtros si los usaras en el futuro
  -- WHERE metadata @> filter -- Descomenta esta línea si empiezas a usar filtros de metadata
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- 4. Crear función match_file_embeddings
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
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- 5. Crear tabla user_tokens_usage si no existe
CREATE TABLE IF NOT EXISTS user_tokens_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  tokens_limit INTEGER DEFAULT 100000,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Crear índices para user_tokens_usage
CREATE INDEX IF NOT EXISTS idx_user_tokens_usage_user_id ON user_tokens_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_usage_last_reset ON user_tokens_usage(last_reset_date);

-- 7. Habilitar RLS en las nuevas tablas
ALTER TABLE file_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens_usage ENABLE ROW LEVEL SECURITY;

-- 8. Crear políticas RLS para file_embeddings
CREATE POLICY "Users can view file_embeddings" ON file_embeddings
  FOR SELECT USING (true); -- Permitir lectura a todos los usuarios autenticados

CREATE POLICY "Users can insert file_embeddings" ON file_embeddings
  FOR INSERT WITH CHECK (true); -- Permitir inserción a todos los usuarios autenticados

CREATE POLICY "Users can update file_embeddings" ON file_embeddings
  FOR UPDATE USING (true); -- Permitir actualización a todos los usuarios autenticados

CREATE POLICY "Users can delete file_embeddings" ON file_embeddings
  FOR DELETE USING (true); -- Permitir eliminación a todos los usuarios autenticados

-- 9. Crear políticas RLS para user_tokens_usage
CREATE POLICY "Users can view their own token usage" ON user_tokens_usage
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own token usage" ON user_tokens_usage
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own token usage" ON user_tokens_usage
  FOR UPDATE USING (user_id = auth.uid()::text);

-- 10. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 11. Crear triggers para actualizar updated_at
CREATE TRIGGER update_file_embeddings_updated_at
    BEFORE UPDATE ON file_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tokens_usage_updated_at
    BEFORE UPDATE ON user_tokens_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 12. Insertar datos de prueba (opcional)
-- Comentar estas líneas si no quieres datos de prueba
/*
INSERT INTO file_embeddings (file_id, chunk_index, content, embedding) VALUES
('test-file-1', 1, 'Este es un chunk de prueba sobre inteligencia artificial y machine learning.', array_fill(0.1, ARRAY[768])::vector),
('test-file-1', 2, 'Segundo chunk sobre procesamiento de lenguaje natural y embeddings.', array_fill(0.2, ARRAY[768])::vector),
('test-file-2', 1, 'Chunk sobre algoritmos de aprendizaje supervisado y no supervisado.', array_fill(0.3, ARRAY[768])::vector);
*/

-- 13. Verificar que todo se creó correctamente
SELECT 'Tablas creadas:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('file_embeddings', 'user_tokens_usage', 'documentos_entrenador');

SELECT 'Funciones creadas:' as status;
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('match_documentos_entrenador', 'match_file_embeddings');

SELECT 'Índices creados:' as status;
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%embedding%';

-- ✅ CONFIGURACIÓN COMPLETA
-- Ahora el sistema de chunking y búsqueda híbrida debería funcionar correctamente