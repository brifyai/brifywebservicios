-- Migración para tabla user_credentials
-- Ejecutar estos comandos en Supabase SQL Editor

-- 1. Agregar nueva columna user_id como UUID
ALTER TABLE user_credentials 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- 2. Agregar columna email
ALTER TABLE user_credentials 
ADD COLUMN email TEXT;

-- 3. Cambiar tipo de telegram_chat_id de bigint a text (permitir null)
ALTER TABLE user_credentials 
ALTER COLUMN telegram_chat_id TYPE TEXT;

-- 4. Hacer telegram_chat_id nullable si no lo es
ALTER TABLE user_credentials 
ALTER COLUMN telegram_chat_id DROP NOT NULL;

-- 5. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_telegram_chat_id ON user_credentials(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_email ON user_credentials(email);

-- 6. Agregar constraint para asegurar que al menos user_id o telegram_chat_id esté presente
ALTER TABLE user_credentials 
ADD CONSTRAINT check_user_identification 
CHECK (user_id IS NOT NULL OR telegram_chat_id IS NOT NULL);

-- 7. Opcional: Limpiar registros existentes que puedan tener datos inconsistentes
-- DELETE FROM user_credentials WHERE telegram_chat_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Estructura final esperada:
-- user_credentials:
--   id (bigint, primary key)
--   user_id (uuid, references auth.users(id))
--   telegram_chat_id (text, nullable)
--   email (text, nullable)
--   google_refresh_token (text)
--   created_at (timestamp)
--   updated_at (timestamp)