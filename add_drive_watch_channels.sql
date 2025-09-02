-- SCRIPT PARA AGREGAR FUNCIONALIDAD DE GOOGLE DRIVE WATCH
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla para almacenar los channels de watch de Google Drive
CREATE TABLE IF NOT EXISTS drive_watch_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL, -- ID de la carpeta de Google Drive
    channel_id TEXT NOT NULL UNIQUE, -- ID único del canal de notificación
    resource_id TEXT, -- ID del recurso devuelto por Google Drive API
    webhook_url TEXT NOT NULL, -- URL del webhook de n8n
    expiration TIMESTAMPTZ, -- Fecha de expiración del watch
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_drive_watch_channels_user_id 
ON drive_watch_channels(user_id);

CREATE INDEX IF NOT EXISTS idx_drive_watch_channels_folder_id 
ON drive_watch_channels(folder_id);

CREATE INDEX IF NOT EXISTS idx_drive_watch_channels_channel_id 
ON drive_watch_channels(channel_id);

CREATE INDEX IF NOT EXISTS idx_drive_watch_channels_active 
ON drive_watch_channels(is_active) WHERE is_active = true;

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE drive_watch_channels ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
-- Política para SELECT: Los usuarios solo pueden ver sus propios watch channels
CREATE POLICY "Users can view their own watch channels"
ON drive_watch_channels FOR SELECT TO authenticated
USING (auth.uid()::uuid = user_id::uuid);

-- Política para INSERT: Los usuarios solo pueden crear sus propios watch channels
CREATE POLICY "Users can insert their own watch channels"
ON drive_watch_channels FOR INSERT TO authenticated
WITH CHECK (auth.uid()::uuid = user_id::uuid);

-- Política para UPDATE: Los usuarios solo pueden actualizar sus propios watch channels
CREATE POLICY "Users can update their own watch channels"
ON drive_watch_channels FOR UPDATE TO authenticated
USING (auth.uid()::uuid = user_id::uuid)
WITH CHECK (auth.uid()::uuid = user_id::uuid);

-- Política para DELETE: Los usuarios solo pueden eliminar sus propios watch channels
CREATE POLICY "Users can delete their own watch channels"
ON drive_watch_channels FOR DELETE TO authenticated
USING (auth.uid()::uuid = user_id::uuid);

-- 5. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_drive_watch_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para actualizar updated_at
CREATE TRIGGER trigger_update_drive_watch_channels_updated_at
    BEFORE UPDATE ON drive_watch_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_drive_watch_channels_updated_at();

-- 7. Crear función para limpiar watch channels expirados
CREATE OR REPLACE FUNCTION cleanup_expired_watch_channels()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Marcar como inactivos los channels expirados
    UPDATE drive_watch_channels 
    SET is_active = false, updated_at = NOW()
    WHERE expiration < NOW() AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Verificar que la tabla se creó correctamente
SELECT 
    'TABLA CREADA' as status,
    'drive_watch_channels' as tabla,
    COUNT(*) as registros
FROM drive_watch_channels
UNION ALL
SELECT 
    'POLÍTICAS RLS' as status,
    tablename as tabla,
    COUNT(*) as registros
FROM pg_policies 
WHERE tablename = 'drive_watch_channels'
GROUP BY tablename;

-- 9. Crear tabla para registrar las notificaciones de Google Drive
CREATE TABLE IF NOT EXISTS drive_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id TEXT NOT NULL,
    resource_id TEXT,
    resource_state TEXT, -- sync, add, remove, update, trash, untrash
    event_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id TEXT,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Crear índices para drive_notifications
CREATE INDEX IF NOT EXISTS idx_drive_notifications_channel_id 
ON drive_notifications(channel_id);

CREATE INDEX IF NOT EXISTS idx_drive_notifications_user_id 
ON drive_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_drive_notifications_created_at 
ON drive_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drive_notifications_processed 
ON drive_notifications(processed) WHERE processed = false;

-- 11. Habilitar RLS para drive_notifications
ALTER TABLE drive_notifications ENABLE ROW LEVEL SECURITY;

-- 12. Crear políticas RLS para drive_notifications
CREATE POLICY "Users can view their own notifications"
ON drive_notifications FOR SELECT TO authenticated
USING (auth.uid()::uuid = user_id::uuid);

CREATE POLICY "System can insert notifications"
ON drive_notifications FOR INSERT TO authenticated
WITH CHECK (true); -- Permitir inserción desde n8n

CREATE POLICY "Users can update their own notifications"
ON drive_notifications FOR UPDATE TO authenticated
USING (auth.uid()::uuid = user_id::uuid)
WITH CHECK (auth.uid()::uuid = user_id::uuid);

-- Mensaje final
RAISE NOTICE '🎉 TABLAS drive_watch_channels Y drive_notifications CREADAS EXITOSAMENTE';
RAISE NOTICE '📋 Políticas RLS configuradas correctamente';
RAISE NOTICE '🔄 Función de limpieza de channels expirados disponible';
RAISE NOTICE '📨 Sistema de notificaciones de Google Drive configurado';
RAISE NOTICE '✅ Listo para implementar Google Drive Watch';}]}}}