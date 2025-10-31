-- Script para verificar la configuración completa del nuevo usuario
-- Ejecutar en Supabase para diagnosticar problemas de setup

-- 1. Verificar si el usuario tiene watch channels activos
SELECT 
    'WATCH CHANNELS' as tipo_verificacion,
    id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    created_at,
    updated_at
FROM drive_watch_channels 
WHERE is_active = true
ORDER BY created_at DESC;

-- 2. Verificar carpetas de administrador
SELECT 
    'CARPETAS ADMIN' as tipo_verificacion,
    id,
    user_id,
    id_drive_carpeta,
    plan_name,
    created_at
FROM carpeta_administrador
ORDER BY created_at DESC;

-- 3. Verificar usuarios recientes
SELECT 
    'USUARIOS RECIENTES' as tipo_verificacion,
    id,
    email,
    created_at,
    updated_at
FROM auth.users
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 4. Verificar notificaciones recientes
SELECT 
    'NOTIFICACIONES' as tipo_verificacion,
    id,
    channel_id,
    resource_id,
    resource_state,
    event_type,
    processed,
    created_at
FROM drive_notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 5. Verificar relación entre usuarios y watch channels
SELECT 
    'RELACION USER-CHANNEL' as tipo_verificacion,
    u.email,
    dwc.id as channel_id,
    dwc.folder_id,
    dwc.is_active,
    dwc.webhook_url,
    dwc.created_at as channel_created,
    ca.plan_name,
    ca.id_drive_carpeta
FROM auth.users u
LEFT JOIN drive_watch_channels dwc ON u.id = dwc.user_id
LEFT JOIN carpeta_administrador ca ON u.id = ca.user_id
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC;

-- 6. Verificar configuración de webhooks
SELECT 
    'WEBHOOK CONFIG' as tipo_verificacion,
    COUNT(*) as total_channels,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_channels,
    COUNT(CASE WHEN webhook_url LIKE '%n8n%' THEN 1 END) as n8n_webhooks,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_channels
FROM drive_watch_channels;

-- 7. Buscar problemas comunes
SELECT 
    'PROBLEMAS DETECTADOS' as tipo_verificacion,
    CASE 
        WHEN COUNT(*) = 0 THEN 'NO HAY WATCH CHANNELS - Usuario debe comprar plan'
        WHEN COUNT(CASE WHEN is_active = true THEN 1 END) = 0 THEN 'TODOS LOS CHANNELS INACTIVOS'
        WHEN COUNT(CASE WHEN webhook_url NOT LIKE '%n8n%' THEN 1 END) > 0 THEN 'WEBHOOK URL INCORRECTA'
        WHEN COUNT(CASE WHEN created_at < NOW() - INTERVAL '30 days' THEN 1 END) > 0 THEN 'HAY CHANNELS MUY ANTIGUOS'
        ELSE 'CONFIGURACION PARECE CORRECTA'
    END as problema_detectado,
    COUNT(*) as total_channels,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_channels
FROM drive_watch_channels;