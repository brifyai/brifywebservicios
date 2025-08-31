-- Migración para agregar columna registro_previo a tabla users
-- Ejecutar en Supabase SQL Editor

-- Agregar columna registro_previo como booleano con valor por defecto true
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS registro_previo BOOLEAN DEFAULT true;

-- Crear índice para mejorar rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_users_registro_previo 
ON users(registro_previo);

-- Comentario explicativo
COMMENT ON COLUMN users.registro_previo IS 
'Indica si el usuario tiene un registro previo en el sistema';

-- Verificar que la columna se agregó correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'registro_previo';

-- Verificar algunos registros de ejemplo
SELECT id, email, registro_previo 
FROM users 
LIMIT 5;