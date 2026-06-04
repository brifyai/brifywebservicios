-- Script para agregar la columna user_id a la tabla carpeta_administrador
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar la columna user_id si no existe
ALTER TABLE carpeta_administrador 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_carpeta_administrador_user_id 
ON carpeta_administrador(user_id);

-- 3. Agregar foreign key constraint para mantener integridad referencial
ALTER TABLE carpeta_administrador 
ADD CONSTRAINT fk_carpeta_administrador_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Verificar la estructura de la tabla después de los cambios
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'carpeta_administrador' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Mostrar registros existentes para verificar
SELECT * FROM carpeta_administrador LIMIT 5;

-- NOTA: Después de ejecutar este script, necesitarás actualizar los registros existentes
-- para asignar el user_id correcto a cada carpeta administrador.
-- Puedes hacerlo manualmente o crear un script adicional si tienes una forma de identificar
-- a qué usuario pertenece cada carpeta.