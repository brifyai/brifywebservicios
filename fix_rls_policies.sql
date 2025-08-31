-- Script para verificar y corregir políticas RLS en user_credentials
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_credentials';

-- 2. Habilitar RLS si no está habilitado
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas existentes para recrearlas
DROP POLICY IF EXISTS "Users can insert their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can view their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can update their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials" ON user_credentials;

-- 4. Crear políticas RLS correctas
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

-- 5. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_credentials'
ORDER BY policyname;

-- 6. Probar consulta de ejemplo (reemplazar con tu user_id real)
-- SELECT * FROM user_credentials WHERE user_id = '51c1649f-b6cf-441f-9110-40893f106533';

-- 7. Verificar que el usuario existe en auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE id = '51c1649f-b6cf-441f-9110-40893f106533';

-- 8. Verificar registros en user_credentials
SELECT user_id, email, google_refresh_token IS NOT NULL as has_refresh_token, 
       google_access_token IS NOT NULL as has_access_token, created_at
FROM user_credentials 
WHERE user_id = '51c1649f-b6cf-441f-9110-40893f106533';