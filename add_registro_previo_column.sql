-- Migración para agregar columna registro_previo a tabla users
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna registro_previo como booleano con valor por defecto true
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS registro_previo BOOLEAN DEFAULT true;

-- 2. Actualizar registros existentes para establecer registro_previo = true
UPDATE users 
SET registro_previo = true 
WHERE registro_previo IS NULL;

-- 3. Crear índice para mejorar rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_users_registro_previo 
ON users(registro_previo);

-- 4. Agregar comentario explicativo
COMMENT ON COLUMN users.registro_previo IS 
'Indica si el usuario tiene un registro previo en el sistema';

-- 5. Verificar que la columna se agregó correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'registro_previo';

-- 6. Mostrar algunos registros de ejemplo
SELECT id, email, name, registro_previo, created_at
FROM users 
LIMIT 5;

-- 7. Contar usuarios con registro_previo = true
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN registro_previo = true THEN 1 END) as usuarios_con_registro_previo,
    COUNT(CASE WHEN registro_previo = false THEN 1 END) as usuarios_sin_registro_previo
FROM users;