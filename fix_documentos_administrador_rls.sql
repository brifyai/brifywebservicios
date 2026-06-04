-- Script para configurar Row Level Security en documentos_administrador
-- Este script resuelve los errores 400 (Bad Request) en las consultas

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

-- Verificar que las políticas se crearon correctamente
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
WHERE tablename = 'documentos_administrador';

SELECT '✅ Políticas RLS configuradas para documentos_administrador' as status;