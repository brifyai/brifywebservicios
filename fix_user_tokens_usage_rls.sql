-- Script para habilitar RLS y crear políticas para user_tokens_usage
-- Ejecutar en Supabase SQL Editor

-- 1. Habilitar RLS en la tabla user_tokens_usage
ALTER TABLE user_tokens_usage ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can insert their own token usage" ON user_tokens_usage;
DROP POLICY IF EXISTS "Users can view their own token usage" ON user_tokens_usage;
DROP POLICY IF EXISTS "Users can update their own token usage" ON user_tokens_usage;
DROP POLICY IF EXISTS "Users can delete their own token usage" ON user_tokens_usage;

-- 3. Crear políticas RLS para user_tokens_usage
CREATE POLICY "Users can insert their own token usage"
ON user_tokens_usage
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::uuid = user_id::uuid
);

CREATE POLICY "Users can view their own token usage"
ON user_tokens_usage
FOR SELECT
TO authenticated
USING (
  auth.uid()::uuid = user_id::uuid
);

CREATE POLICY "Users can update their own token usage"
ON user_tokens_usage
FOR UPDATE
TO authenticated
USING (
  auth.uid()::uuid = user_id::uuid
)
WITH CHECK (
  auth.uid()::uuid = user_id::uuid
);

CREATE POLICY "Users can delete their own token usage"
ON user_tokens_usage
FOR DELETE
TO authenticated
USING (
  auth.uid()::uuid = user_id::uuid
);

-- 4. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_tokens_usage'
ORDER BY policyname;

-- 5. Verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_tokens_usage';

-- 6. Probar consulta de ejemplo (reemplazar con tu user_id real)
-- SELECT * FROM user_tokens_usage WHERE user_id = '51c1649f-b6cf-441f-9110-40893f106533';