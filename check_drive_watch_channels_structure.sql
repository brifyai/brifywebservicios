-- Script para verificar la estructura de drive_watch_channels
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura de la tabla drive_watch_channels
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'drive_watch_channels'
ORDER BY ordinal_position;

-- 2. Verificar datos existentes en drive_watch_channels
SELECT 
    id,
    channel_id,
    user_id,
    folder_id,
    is_active,
    created_at
FROM drive_watch_channels
ORDER BY created_at DESC;

-- 3. Verificar foreign key constraints en drive_notifications
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'drive_notifications'::regclass
AND contype = 'f';

-- 4. Verificar si el channel_id '96536a5c-1824-4452-a732-c0bb4e5cd08b' existe
SELECT 
    'VERIFICACION CHANNEL_ID' as test,
    COUNT(*) as existe_en_id,
    (SELECT COUNT(*) FROM drive_watch_channels WHERE channel_id = '96536a5c-1824-4452-a732-c0bb4e5cd08b') as existe_en_channel_id
FROM drive_watch_channels 
WHERE id = '96536a5c-1824-4452-a732-c0bb4e5cd08b';