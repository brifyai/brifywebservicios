-- Script para verificar y crear el watch channel específico
-- Channel ID: 6cf57f59-1778-4cf2-a32a-df2a9f84461b

-- 1. Verificar si existe el watch channel
SELECT 
    'VERIFICACION CHANNEL' as tipo,
    id,
    channel_id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    created_at
FROM drive_watch_channels 
WHERE channel_id = '6cf57f59-1778-4cf2-a32a-df2a9f84461b';

-- 2. Verificar usuarios disponibles
SELECT 
    'USUARIOS DISPONIBLES' as tipo,
    id,
    email,
    created_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Verificar carpetas administrador disponibles
SELECT 
    'CARPETAS ADMIN' as tipo,
    id,
    user_id,
    id_drive_carpeta,
    plan_name,
    created_at
FROM carpeta_administrador 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Si no existe, crear el watch channel
-- DESCOMENTA Y MODIFICA SEGÚN LOS DATOS OBTENIDOS ARRIBA
/*
INSERT INTO drive_watch_channels (
    channel_id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    created_at
) VALUES (
    '6cf57f59-1778-4cf2-a32a-df2a9f84461b',
    'USER_ID_AQUI', -- Reemplazar con un user_id válido del paso 2
    'FOLDER_ID_AQUI', -- Reemplazar con un id_drive_carpeta del paso 3
    'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135',
    true,
    NOW()
);
*/

-- 5. Verificar que se creó correctamente
SELECT 
    'VERIFICACION FINAL' as tipo,
    dwc.*,
    u.email as user_email,
    ca.plan_name
FROM drive_watch_channels dwc
LEFT JOIN auth.users u ON dwc.user_id = u.id
LEFT JOIN carpeta_administrador ca ON dwc.user_id = ca.user_id
WHERE dwc.channel_id = '6cf57f59-1778-4cf2-a32a-df2a9f84461b';

-- INSTRUCCIONES:
-- 1. Ejecutar consultas 1-3 para verificar estado actual
-- 2. Si el channel no existe, descomentar y completar el INSERT del paso 4
-- 3. Ejecutar consulta 5 para verificar el resultado