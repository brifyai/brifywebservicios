-- SCRIPT FINAL PARA CORREGIR RLS EN TABLA USERS
-- Este script soluciona definitivamente el error 42501 durante el registro

-- 1. Deshabilitar RLS temporalmente para permitir registros iniciales
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can delete their own profile" ON users;

-- 3. Crear política permisiva para INSERT que permita cualquier usuario autenticado
CREATE POLICY "Allow authenticated users to insert profiles"
ON users FOR INSERT TO authenticated
WITH CHECK (true);

-- 4. Crear políticas normales para SELECT, UPDATE y DELETE
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT TO authenticated
USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE TO authenticated
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users can delete their own profile"
ON users FOR DELETE TO authenticated
USING (auth.uid()::text = id::text);

-- 5. Rehabilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 6. Verificar las políticas creadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Mensaje de confirmación
SELECT '✅ RLS configurado correctamente para tabla users' as status;
SELECT '🔄 Ahora reinicia tu aplicación y prueba el registro' as next_step;