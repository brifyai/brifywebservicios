-- Script para verificar y crear el watch channel d53c2c7a-22c9-4afb-8f01-2df3ad8273af
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si el watch channel existe
SELECT 
    'WATCH CHANNEL ENCONTRADO' as status,
    id,
    user_id,
    folder_id,
    channel_id,
    resource_id,
    webhook_url,
    expiration,
    is_active,
    created_at
FROM drive_watch_channels 
WHERE channel_id = 'd53c2c7a-22c9-4afb-8f01-2df3ad8273af';

-- 2. Si no existe, mostrar usuarios disponibles
SELECT 
    'USUARIOS DISPONIBLES' as info,
    id as user_id,
    email,
    plan_name
FROM users 
WHERE plan_name IS NOT NULL
ORDER BY created_at DESC;

-- 3. Mostrar carpetas administrador disponibles
SELECT 
    'CARPETAS ADMINISTRADOR' as info,
    id,
    user_id,
    correo,
    id_drive_carpeta as folder_id,
    plan_name
FROM carpeta_administrador
ORDER BY id DESC;

-- 4. TEMPLATE: Si necesitas crear el watch channel, usa este INSERT
-- (Descomenta y ajusta los valores según los resultados anteriores)
/*
INSERT INTO drive_watch_channels (
    user_id,
    folder_id,
    channel_id,
    resource_id,
    webhook_url,
    expiration,
    is_active
) VALUES (
    '6cf57f59-1778-4cf2-a32a-df2a9f84461b', -- user_id del usuario
    '1y-VHDmIi3j4VxAp7gduTEy4zHAG_XL-H', -- folder_id de la carpeta
    'd53c2c7a-22c9-4afb-8f01-2df3ad8273af', -- channel_id correcto
    'k-JJvlGMbp2XtnU7ZmH6RGRsVhA', -- resource_id de Google Drive
    'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135',
    '2025-09-02 04:19:09+00'::timestamptz,
    true
);
*/

-- 5. Verificar después de crear
-- SELECT * FROM drive_watch_channels WHERE channel_id = 'd53c2c7a-22c9-4afb-8f01-2df3ad8273af';