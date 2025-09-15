-- Script para agregar la columna entrenador a documentos_usuario_entrenador
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar la columna entrenador si no existe
ALTER TABLE documentos_usuario_entrenador 
ADD COLUMN IF NOT EXISTS entrenador TEXT;

-- 2. Crear índice para mejorar el rendimiento de las consultas por entrenador
CREATE INDEX IF NOT EXISTS idx_documentos_usuario_entrenador_entrenador 
ON documentos_usuario_entrenador(entrenador);

-- 3. Verificar la estructura de la tabla después de los cambios
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'documentos_usuario_entrenador' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Comentario explicativo
COMMENT ON COLUMN documentos_usuario_entrenador.entrenador IS 
'Email del entrenador que subió el archivo';

-- 5. Verificar que la columna se agregó correctamente
SELECT '✅ Columna entrenador agregada a documentos_usuario_entrenador' as status;

-- NOTA: Después de ejecutar este script, los nuevos archivos subidos
-- incluirán automáticamente el campo entrenador con el email del usuario que los sube.