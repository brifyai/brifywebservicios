-- SCRIPT URGENTE PARA CORREGIR SUPABASE
-- Copia y pega este código completo en el SQL Editor de Supabase

-- 1. Agregar restricción UNIQUE a user_credentials si no existe
DO $$ 
BEGIN
    -- Eliminar duplicados primero
    DELETE FROM user_credentials 
    WHERE id NOT IN (
        SELECT MIN(id) 
        FROM user_credentials 
        GROUP BY user_id
    );
    
    -- Agregar restricción UNIQUE
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_user_credentials_user_id'
        AND conrelid = 'user_credentials'::regclass
    ) THEN
        ALTER TABLE user_credentials 
        ADD CONSTRAINT unique_user_credentials_user_id 
        UNIQUE (user_id);
        RAISE NOTICE '✅ Restricción UNIQUE agregada a user_credentials';
    ELSE
        RAISE NOTICE '✅ Restricción UNIQUE ya existe en user_credentials';
    END IF;
END $$;

-- 2. Habilitar RLS y crear políticas para user_credentials
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can insert their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can view their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can update their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials" ON user_credentials;

-- Crear políticas nuevas con casting correcto
CREATE POLICY "Users can insert their own credentials"
ON user_credentials FOR INSERT TO authenticated
WITH CHECK (auth.uid()::uuid = user_id::uuid);

CREATE POLICY "Users can view their own credentials"
ON user_credentials FOR SELECT TO authenticated
USING (auth.uid()::uuid = user_id::uuid);

CREATE POLICY "Users can update their own credentials"
ON user_credentials FOR UPDATE TO authenticated
USING (auth.uid()::uuid = user_id::uuid)
WITH CHECK (auth.uid()::uuid = user_id::uuid);

CREATE POLICY "Users can delete their own credentials"
ON user_credentials FOR DELETE TO authenticated
USING (auth.uid()::uuid = user_id::uuid);

-- 3. Verificar y corregir políticas de users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Eliminar política recursiva problemática
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Crear políticas correctas para users
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT TO authenticated
USING (auth.uid()::uuid = id::uuid);

CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE TO authenticated
USING (auth.uid()::uuid = id::uuid)
WITH CHECK (auth.uid()::uuid = id::uuid);

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT TO authenticated
WITH CHECK (auth.uid()::uuid = id::uuid);

-- 4. Verificar y corregir políticas de user_tokens_usage
ALTER TABLE user_tokens_usage ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view their own token usage" ON user_tokens_usage;
DROP POLICY IF EXISTS "Users can update their own token usage" ON user_tokens_usage;
DROP POLICY IF EXISTS "Users can insert their own token usage" ON user_tokens_usage;

-- Crear políticas correctas para user_tokens_usage
CREATE POLICY "Users can view their own token usage"
ON user_tokens_usage FOR SELECT TO authenticated
USING (auth.uid()::uuid = user_id::uuid);

CREATE POLICY "Users can update their own token usage"
ON user_tokens_usage FOR UPDATE TO authenticated
USING (auth.uid()::uuid = user_id::uuid)
WITH CHECK (auth.uid()::uuid = user_id::uuid);

CREATE POLICY "Users can insert their own token usage"
ON user_tokens_usage FOR INSERT TO authenticated
WITH CHECK (auth.uid()::uuid = user_id::uuid);

-- 5. Verificar que todo esté correcto
SELECT 
    'RESTRICCIONES' as tipo,
    conname as nombre,
    'user_credentials' as tabla
FROM pg_constraint 
WHERE conrelid = 'user_credentials'::regclass
  AND contype = 'u'
UNION ALL
SELECT 
    'POLÍTICAS RLS' as tipo,
    policyname as nombre,
    tablename as tabla
FROM pg_policies 
WHERE tablename IN ('user_credentials', 'users', 'user_tokens_usage')
ORDER BY tipo, tabla, nombre;

-- 6. Agregar columnas faltantes a documentos_entrenador
DO $$ 
BEGIN
    -- Agregar columna created_at si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documentos_entrenador' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE documentos_entrenador 
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE '✅ Columna created_at agregada a documentos_entrenador';
    ELSE
        RAISE NOTICE '✅ Columna created_at ya existe en documentos_entrenador';
    END IF;
    
    -- Agregar columna folder_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documentos_entrenador' 
        AND column_name = 'folder_id'
    ) THEN
        ALTER TABLE documentos_entrenador 
        ADD COLUMN folder_id TEXT;
        RAISE NOTICE '✅ Columna folder_id agregada a documentos_entrenador';
    ELSE
        RAISE NOTICE '✅ Columna folder_id ya existe en documentos_entrenador';
    END IF;
END $$;

-- 7. Corregir tipo de dato telegram_id en carpetas_usuario para manejar null
DO $$ 
BEGIN
    -- Verificar si la columna telegram_id permite NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carpetas_usuario' 
        AND column_name = 'telegram_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE carpetas_usuario 
        ALTER COLUMN telegram_id DROP NOT NULL;
        RAISE NOTICE '✅ Columna telegram_id en carpetas_usuario ahora permite NULL';
    ELSE
        RAISE NOTICE '✅ Columna telegram_id ya permite NULL en carpetas_usuario';
    END IF;
END $$;

-- 8. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_created_at 
ON documentos_entrenador(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_entrenador 
ON documentos_entrenador(entrenador);

CREATE INDEX IF NOT EXISTS idx_carpetas_usuario_telegram_id 
ON carpetas_usuario(telegram_id) WHERE telegram_id IS NOT NULL;

-- Mensaje final
RAISE NOTICE '🎉 SCRIPT COMPLETADO - Verifica los resultados arriba';
RAISE NOTICE '📋 Ahora reinicia tu aplicación React y prueba el login';
RAISE NOTICE '🔄 Los datos deberían persistir después del refresh';
RAISE NOTICE '📁 Errores de Files.js corregidos: created_at y telegram_id null';}]}}}