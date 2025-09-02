-- Script para verificar los watch channels existentes en Supabase
-- Ejecutar en el SQL Editor de Supabase

-- Ver todos los watch channels activos
SELECT 
  id,
  channel_id,
  user_id,
  folder_id,
  webhook_url,
  is_active,
  created_at,
  expires_at
FROM drive_watch_channels 
WHERE is_active = true
ORDER BY created_at DESC;

-- Ver también los inactivos para referencia
SELECT 
  id,
  channel_id,
  user_id,
  folder_id,
  webhook_url,
  is_active,
  created_at,
  expires_at
FROM drive_watch_channels 
WHERE is_active = false
ORDER BY created_at DESC
LIMIT 5;

-- Contar total de watch channels
SELECT 
  COUNT(*) as total_channels,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_channels,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_channels
FROM drive_watch_channels;