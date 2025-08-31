-- Migración para agregar columna 'cliente' a la tabla users
-- Esta columna identificará a los usuarios creados automáticamente desde carpetas

-- Agregar la columna 'cliente' de tipo booleano con valor por defecto false
ALTER TABLE users 
ADD COLUMN cliente BOOLEAN DEFAULT false;

-- Crear un índice para mejorar las consultas de filtrado por cliente
CREATE INDEX idx_users_cliente ON users(cliente);

-- Agregar comentario a la columna para documentación
COMMENT ON COLUMN users.cliente IS 'Indica si el usuario fue creado automáticamente desde una carpeta (true) o es un usuario regular (false)';

-- Verificar que la columna se agregó correctamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'cliente';

-- Mostrar algunos registros de ejemplo para verificar
SELECT id, email, name, cliente, created_at 
FROM users 
LIMIT 5;