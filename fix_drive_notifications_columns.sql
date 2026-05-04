-- SCRIPT PARA AGREGAR COLUMNAS FALTANTES A drive_notifications
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna changed_files para almacenar archivos modificados
ALTER TABLE drive_notifications 
ADD COLUMN IF NOT EXISTS changed_files JSONB DEFAULT '[]'::jsonb;

-- 2. Agregar columna resource_uri para almacenar URI del recurso
ALTER TABLE drive_notifications 
ADD COLUMN IF NOT EXISTS resource_uri TEXT;

-- 3. Agregar columna notification_data para almacenar datos completos del webhook
ALTER TABLE drive_notifications 
ADD COLUMN IF NOT EXISTS notification_data JSONB;

-- 4. Agregar columna processed_at para timestamp de procesamiento
ALTER TABLE drive_notifications 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 5. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_drive_notifications_changed_files 
ON drive_notifications USING GIN(changed_files);

CREATE INDEX IF NOT EXISTS idx_drive_notifications_processed_at 
ON drive_notifications(processed_at);

-- 6. Verificar que las columnas se agregaron correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'drive_notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Verificar estructura completa de la tabla
\d drive_notifications;

-- Mensaje final
RAISE NOTICE '✅ Columnas agregadas exitosamente a drive_notifications';
RAISE NOTICE '📊 changed_files: JSONB para archivos modificados';
RAISE NOTICE '🔗 resource_uri: TEXT para URI del recurso';
RAISE NOTICE '📦 notification_data: JSONB para datos completos del webhook';
RAISE NOTICE '⏰ processed_at: TIMESTAMPTZ para timestamp de procesamiento';
RAISE NOTICE '🚀 Tabla drive_notifications lista para recibir webhooks de Google Drive';