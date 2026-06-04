-- Script para verificar todos los watch channels activos en la base de datos
-- Ejecutar en Supabase SQL Editor

SELECT 
    id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    expires_at,
    created_at,
    updated_at
FROM drive_watch_channels 
WHERE is_active = true
ORDER BY created_at DESC;

-- También verificar todos los channels (activos e inactivos)
SELECT 
    'TODOS LOS CHANNELS' as tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
    COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM drive_watch_channels;

-- Verificar si existe el channel ID específico del usuario
SELECT 
    id,
    user_id,
    is_active,
    expires_at,
    'CHANNEL ESPECÍFICO' as nota
FROM drive_watch_channels 
WHERE id = 'b42801e5-ee16-4715-aa44-82d2e0ae8811';