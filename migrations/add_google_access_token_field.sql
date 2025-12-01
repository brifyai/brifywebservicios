-- Migración para agregar campo google_access_token a tabla user_credentials
-- Ejecutar en Supabase SQL Editor

-- Agregar campo google_access_token
ALTER TABLE user_credentials 
ADD COLUMN IF NOT EXISTS google_access_token TEXT;

-- Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_credentials_google_access_token 
ON user_credentials(google_access_token);

-- Comentario explicativo
COMMENT ON COLUMN user_credentials.google_access_token IS 
'Token de acceso de Google Drive para autenticación API';

-- Verificar estructura actualizada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_credentials' 
AND column_name IN ('google_refresh_token', 'google_access_token')
ORDER BY column_name;