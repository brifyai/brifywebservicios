-- Script para agregar restricción única a documentos_usuario_entrenador
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar registros duplicados si existen (mantener el más reciente)
DELETE FROM documentos_usuario_entrenador 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM documentos_usuario_entrenador 
    GROUP BY usuario
);

-- 2. Agregar restricción UNIQUE en la columna usuario
ALTER TABLE documentos_usuario_entrenador 
ADD CONSTRAINT documentos_usuario_entrenador_usuario_unique 
UNIQUE (usuario);

-- 3. Verificar que la restricción se creó correctamente
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'documentos_usuario_entrenador'::regclass
AND contype = 'u';

-- 4. Verificar que no hay duplicados
SELECT usuario, COUNT(*) as count
FROM documentos_usuario_entrenador 
GROUP BY usuario 
HAVING COUNT(*) > 1;

-- Comentario explicativo
COMMENT ON CONSTRAINT documentos_usuario_entrenador_usuario_unique ON documentos_usuario_entrenador IS 
'Garantiza que cada usuario tenga solo un registro en documentos_usuario_entrenador';