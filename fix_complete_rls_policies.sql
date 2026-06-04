-- Script completo para configurar Row Level Security (RLS)
-- Este script resuelve los errores 400 (Bad Request) en las consultas

-- =====================================================
-- 1. CONFIGURAR RLS PARA DOCUMENTOS_ADMINISTRADOR
-- =====================================================

-- Habilitar RLS en documentos_administrador
ALTER TABLE documentos_administrador ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver sus propios documentos
-- Los usuarios pueden ver documentos donde el campo 'cliente' coincide con su email
CREATE POLICY "Users can view their own documents" ON documentos_administrador
    FOR SELECT
    USING (
        cliente = auth.jwt() ->> 'email'
        OR 
        administrador = auth.jwt() ->> 'email'
    );

-- Política para que los usuarios puedan insertar sus propios documentos
CREATE POLICY "Users can insert their own documents" ON documentos_administrador
    FOR INSERT
    WITH CHECK (
        cliente = auth.jwt() ->> 'email'
        OR 
        administrador = auth.jwt() ->> 'email'
    );

-- Política para que los usuarios puedan actualizar sus propios documentos
CREATE POLICY "Users can update their own documents" ON documentos_administrador
    FOR UPDATE
    USING (
        cliente = auth.jwt() ->> 'email'
        OR 
        administrador = auth.jwt() ->> 'email'
    )
    WITH CHECK (
        cliente = auth.jwt() ->> 'email'
        OR 
        administrador = auth.jwt() ->> 'email'
    );

-- Política para que los usuarios puedan eliminar sus propios documentos
CREATE POLICY "Users can delete their own documents" ON documentos_administrador
    FOR DELETE
    USING (
        cliente = auth.jwt() ->> 'email'
        OR 
        administrador = auth.jwt() ->> 'email'
    );

-- =====================================================
-- 2. CONFIGURAR RLS PARA PLANS
-- =====================================================

-- Habilitar RLS en plans
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Política para que todos los usuarios autenticados puedan ver los planes
-- Los planes son públicos para que los usuarios puedan elegir
CREATE POLICY "Authenticated users can view plans" ON plans
    FOR SELECT
    TO authenticated
    USING (true);

-- Política para que solo administradores puedan insertar planes
CREATE POLICY "Only admins can insert plans" ON plans
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.admin = true
        )
    );

-- Política para que solo administradores puedan actualizar planes
CREATE POLICY "Only admins can update plans" ON plans
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.admin = true
        )
    );

-- Política para que solo administradores puedan eliminar planes
CREATE POLICY "Only admins can delete plans" ON plans
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.admin = true
        )
    );

-- =====================================================
-- 3. VERIFICAR POLÍTICAS EXISTENTES
-- =====================================================

-- Verificar políticas de documentos_administrador
SELECT 
    'documentos_administrador' as tabla,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'documentos_administrador'
ORDER BY policyname;

-- Verificar políticas de plans
SELECT 
    'plans' as tabla,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'plans'
ORDER BY policyname;

-- Verificar políticas de user_tokens_usage (ya existentes)
SELECT 
    'user_tokens_usage' as tabla,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'user_tokens_usage'
ORDER BY policyname;

-- =====================================================
-- 4. MENSAJE DE CONFIRMACIÓN
-- =====================================================

SELECT '✅ Políticas RLS configuradas correctamente para:' as status;
SELECT '   - documentos_administrador' as tabla_1;
SELECT '   - plans' as tabla_2;
SELECT '   - user_tokens_usage (ya existía)' as tabla_3;
SELECT '🔒 Los errores 400 (Bad Request) deberían estar resueltos' as resultado;