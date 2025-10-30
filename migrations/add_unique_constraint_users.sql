-- Migración para agregar restricción única en tabla users
-- Ejecutar en Supabase SQL Editor

-- Paso 1: Eliminar registros duplicados si existen (mantener el más reciente)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC) as rn
  FROM users
)
DELETE FROM users 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Paso 2: Agregar restricción única en la columna id (si no existe ya)
-- Nota: La columna id ya debería ser PRIMARY KEY, pero esto asegura unicidad
ALTER TABLE users 
ADD CONSTRAINT users_id_unique UNIQUE (id);

-- Verificar que no hay duplicados
SELECT id, COUNT(*) as count
FROM users 
GROUP BY id 
HAVING COUNT(*) > 1;