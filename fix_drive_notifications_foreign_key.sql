-- SCRIPT PARA ARREGLAR RELACIÓN ENTRE drive_notifications Y drive_watch_channels
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar foreign key constraint entre drive_notifications.channel_id y drive_watch_channels.channel_id
ALTER TABLE drive_notifications 
ADD CONSTRAINT fk_drive_notifications_channel_id 
FOREIGN KEY (channel_id) 
REFERENCES drive_watch_channels(channel_id) 
ON DELETE CASCADE;

-- 2. Crear índice para mejorar rendimiento del join
CREATE INDEX IF NOT EXISTS idx_drive_notifications_channel_id_fk 
ON drive_notifications(channel_id);

-- 3. Verificar que la relación se creó correctamente
SELECT 
    'FOREIGN KEY CREADA' as status,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table
FROM pg_constraint 
WHERE conname = 'fk_drive_notifications_channel_id';

-- 4. Verificar que el join ahora funciona
SELECT 
    'TEST JOIN' as test,
    COUNT(*) as total_notifications
FROM drive_notifications dn
INNER JOIN drive_watch_channels dwc ON dn.channel_id = dwc.channel_id;

-- Mensaje final
RAISE NOTICE '✅ Foreign key entre drive_notifications y drive_watch_channels creada exitosamente';
RAISE NOTICE '🔗 Ahora el join en driveNotificationHandler.js debería funcionar correctamente';