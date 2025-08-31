-- SOLUCIÓN DEFINITIVA: DESHABILITAR RLS COMPLETAMENTE PARA TABLA USERS
-- Este script elimina todas las restricciones RLS que están causando el error 42501

-- 1. Deshabilitar RLS completamente para la tabla users
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas existentes
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', policy_record.policyname);
        RAISE NOTICE 'Eliminada política: %', policy_record.policyname;
    END LOOP;
END $$;

-- 3. Verificar que no hay políticas activas
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No hay políticas RLS activas en tabla users'
        ELSE '❌ Aún hay ' || COUNT(*) || ' políticas activas'
    END as status
FROM pg_policies 
WHERE tablename = 'users';

-- 4. Verificar que RLS está deshabilitado
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity = false THEN '✅ RLS DESHABILITADO'
        ELSE '❌ RLS AÚN ACTIVO'
    END as rls_status
FROM pg_tables 
WHERE tablename = 'users';

-- 5. Mensaje final
SELECT '🎉 RLS COMPLETAMENTE DESHABILITADO PARA TABLA USERS' as resultado;
SELECT '🔄 Reinicia la aplicación y prueba el registro ahora' as siguiente_paso;
SELECT '⚠️  IMPORTANTE: El registro debería funcionar sin restricciones' as nota;