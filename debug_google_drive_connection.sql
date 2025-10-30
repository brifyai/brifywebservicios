-- SCRIPT DE DEBUG PARA VERIFICAR CONEXIÓN GOOGLE DRIVE
-- Ejecuta este script en Supabase para verificar el estado actual

-- 1. Verificar datos en user_credentials
SELECT 
    'USER_CREDENTIALS' as tabla,
    user_id,
    email,
    CASE 
        WHEN google_refresh_token IS NOT NULL AND google_refresh_token != '' THEN 'SÍ TIENE TOKEN'
        ELSE 'NO TIENE TOKEN'
    END as tiene_refresh_token,
    CASE 
        WHEN google_access_token IS NOT NULL AND google_access_token != '' THEN 'SÍ TIENE ACCESS'
        ELSE 'NO TIENE ACCESS'
    END as tiene_access_token,
    created_at,
    updated_at
FROM user_credentials
WHERE user_id = '51c1649f-b6cf-441f-9110-40893f106533'  -- Reemplaza con tu user_id real
ORDER BY updated_at DESC;

-- 2. Verificar datos en users
SELECT 
    'USERS' as tabla,
    id,
    name,
    email,
    current_plan_id,
    is_active,
    plan_expiration,
    created_at
FROM users
WHERE id = '51c1649f-b6cf-441f-9110-40893f106533';  -- Reemplaza con tu user_id real

-- 3. Verificar si las políticas RLS están funcionando
-- (Ejecuta esto como el usuario autenticado)
SELECT 
    'TEST_RLS' as test,
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid()::text = '51c1649f-b6cf-441f-9110-40893f106533' THEN 'USER_ID_MATCHES'
        ELSE 'USER_ID_NO_MATCH'
    END as auth_check;

-- 4. Probar consulta como la hace el frontend
SELECT 
    uc.user_id,
    uc.email,
    uc.google_refresh_token,
    uc.google_access_token,
    u.name,
    u.current_plan_id,
    u.is_active,
    u.plan_expiration
FROM user_credentials uc
LEFT JOIN users u ON u.id = uc.user_id
WHERE uc.user_id = auth.uid();

-- 5. Verificar restricciones y políticas
SELECT 
    'CONSTRAINTS' as tipo,
    conname as nombre
FROM pg_constraint 
WHERE conrelid = 'user_credentials'::regclass
UNION ALL
SELECT 
    'POLICIES' as tipo,
    policyname as nombre
FROM pg_policies 
WHERE tablename = 'user_credentials'
ORDER BY tipo, nombre;

-- INSTRUCCIONES:
-- 1. Reemplaza '51c1649f-b6cf-441f-9110-40893f106533' con tu user_id real
-- 2. Ejecuta cada consulta por separado
-- 3. Verifica que:
--    - Tienes datos en user_credentials
--    - Los tokens no están vacíos
--    - Las políticas RLS existen
--    - La consulta combinada devuelve datos