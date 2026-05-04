-- Políticas RLS para tabla user_credentials
-- Ejecutar estos comandos en Supabase SQL Editor

-- 1. Habilitar RLS en la tabla user_credentials (si no está habilitado)
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- 2. Política para permitir INSERT a usuarios autenticados
-- Solo pueden insertar credenciales para su propio user_id
CREATE POLICY "Users can insert their own credentials"
ON user_credentials
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

-- 3. Política para permitir SELECT a usuarios autenticados
-- Solo pueden ver sus propias credenciales
CREATE POLICY "Users can view their own credentials"
ON user_credentials
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
);

-- 4. Política para permitir UPDATE a usuarios autenticados
-- Solo pueden actualizar sus propias credenciales
CREATE POLICY "Users can update their own credentials"
ON user_credentials
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

-- 5. Política para permitir DELETE a usuarios autenticados
-- Solo pueden eliminar sus propias credenciales
CREATE POLICY "Users can delete their own credentials"
ON user_credentials
FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
);

-- 6. Política adicional para administradores (opcional)
-- Los administradores pueden ver todas las credenciales
-- Descomenta si necesitas acceso de administrador
/*
CREATE POLICY "Admins can view all credentials"
ON user_credentials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()) 
    AND users.admin = true
  )
);
*/

-- Verificar políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_credentials';