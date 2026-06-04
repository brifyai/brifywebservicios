-- Script completo para corregir user_credentials
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura actual de la tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_credentials'
ORDER BY ordinal_position;

-- 2. Verificar restricciones existentes
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'user_credentials'::regclass;

-- 3. Eliminar duplicados si existen
DELETE FROM user_credentials 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM user_credentials 
    GROUP BY user_id
);

-- 4. Agregar restricción UNIQUE si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_user_credentials_user_id'
        AND conrelid = 'user_credentials'::regclass
    ) THEN
        ALTER TABLE user_credentials 
        ADD CONSTRAINT unique_user_credentials_user_id 
        UNIQUE (user_id);
        RAISE NOTICE 'Restricción UNIQUE agregada exitosamente';
    ELSE
        RAISE NOTICE 'Restricción UNIQUE ya existe';
    END IF;
END $$;

-- 5. Habilitar RLS
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- 6. Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can insert their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can view their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can update their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials" ON user_credentials;

-- 7. Crear políticas RLS con casting explícito
CREATE POLICY "Users can insert their own credentials"
ON user_credentials
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::uuid = user_id::uuid
);

CREATE POLICY "Users can view their own credentials"
ON user_credentials
FOR SELECT
TO authenticated
USING (
  auth.uid()::uuid = user_id::uuid
);

CREATE POLICY "Users can update their own credentials"
ON user_credentials
FOR UPDATE
TO authenticated
USING (
  auth.uid()::uuid = user_id::uuid
)
WITH CHECK (
  auth.uid()::uuid = user_id::uuid
);

CREATE POLICY "Users can delete their own credentials"
ON user_credentials
FOR DELETE
TO authenticated
USING (
  auth.uid()::uuid = user_id::uuid
);

-- 8. Verificar que todo se creó correctamente
SELECT 'Restricciones:' as tipo, conname as nombre
FROM pg_constraint 
WHERE conrelid = 'user_credentials'::regclass
UNION ALL
SELECT 'Políticas RLS:' as tipo, policyname as nombre
FROM pg_policies 
WHERE tablename = 'user_credentials'
ORDER BY tipo, nombre;

-- 9. Probar UPSERT (reemplazar con tu user_id real)
-- INSERT INTO user_credentials (user_id, email, google_refresh_token) 
-- VALUES ('51c1649f-b6cf-441f-9110-40893f106533', 'test@example.com', 'test_token')
-- ON CONFLICT (user_id) DO UPDATE SET 
--   email = EXCLUDED.email,
--   google_refresh_token = EXCLUDED.google_refresh_token,
--   updated_at = NOW();

RAISE NOTICE 'Script completado. Verifica los resultados arriba.';