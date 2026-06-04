-- Script para verificar y crear el watch channel faltante
-- Channel ID actual: 96536a5c-1824-4452-a732-c0bb4e5cd08b

-- 1. Verificar si existe el watch channel actual
SELECT 
    channel_id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    created_at,
    expires_at
FROM drive_watch_channels 
WHERE channel_id = '96536a5c-1824-4452-a732-c0bb4e5cd08b';

-- 2. Verificar usuarios disponibles
SELECT id, email FROM auth.users LIMIT 5;

-- 3. Verificar carpetas administrador disponibles
SELECT 
    id,
    user_id,
    id_drive_carpeta,
    nombre_carpeta,
    created_at
FROM carpeta_administrador 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Verificar credenciales de Google disponibles
SELECT 
    user_id,
    google_access_token IS NOT NULL as has_access_token,
    google_refresh_token IS NOT NULL as has_refresh_token,
    created_at
FROM user_google_credentials 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Si el watch channel no existe, crear uno nuevo
-- IMPORTANTE: Ejecutar solo si el SELECT del paso 1 no devuelve resultados
-- Reemplazar los valores según los datos obtenidos en los pasos anteriores

/*
INSERT INTO drive_watch_channels (
    channel_id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    created_at,
    expires_at
) VALUES (
    '96536a5c-1824-4452-a732-c0bb4e5cd08b',
    'USER_ID_AQUI', -- Reemplazar con un user_id válido del paso 2
    'FOLDER_ID_AQUI', -- Reemplazar con un id_drive_carpeta del paso 3
    'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/google-drive-notifications',
    true,
    NOW(),
    NOW() + INTERVAL '7 days'
);
*/

-- 6. Verificar que el watch channel se creó correctamente
SELECT 
    channel_id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    created_at,
    expires_at
FROM drive_watch_channels 
WHERE channel_id = '96536a5c-1824-4452-a732-c0bb4e5cd08b';

-- 7. Activar el watch channel si existe pero está inactivo
/*
UPDATE drive_watch_channels 
SET 
    is_active = true,
    expires_at = NOW() + INTERVAL '7 days'
WHERE channel_id = '96536a5c-1824-4452-a732-c0bb4e5cd08b';
*/

-- INSTRUCCIONES:
-- 1. Ejecutar los SELECT (pasos 1-4) para obtener información
-- 2. Si el watch channel no existe, descomentar y completar el INSERT del paso 5
-- 3. Si existe pero está inactivo, descomentar el UPDATE del paso 7
-- 4. Verificar el resultado con el SELECT del paso 6
-- Ejecutar en el editor SQL de Supabase

-- 1. Verificar si el watch channel existe
SELECT 
    id,
    channel_id,
    resource_id,
    folder_id,
    user_id,
    is_active,
    expires_at,
    created_at
FROM drive_watch_channels 
WHERE channel_id = '72f250e8-1669-40bc-b84d-7fb24c76b4c9';

-- 2. Si no existe, verificar qué usuarios y carpetas están disponibles
SELECT 
    u.id as user_id,
    u.email,
    ca.id_drive_carpeta as folder_id,
    ca.plan_name
FROM users u
JOIN carpeta_administrador ca ON u.email = ca.correo
WHERE u.is_active = true
LIMIT 5;

-- 3. Verificar si hay credenciales de Google para algún usuario
SELECT 
    uc.user_id,
    u.email,
    CASE 
        WHEN uc.google_access_token IS NOT NULL THEN 'Sí'
        ELSE 'No'
    END as tiene_token
FROM user_credentials uc
JOIN users u ON uc.user_id = u.id
WHERE uc.google_access_token IS NOT NULL
LIMIT 5;

-- 4. CREAR WATCH CHANNEL MANUALMENTE (solo ejecutar si no existe)
-- Reemplaza los valores según los resultados de las consultas anteriores

/*
INSERT INTO drive_watch_channels (
    channel_id,
    resource_id,
    folder_id,
    user_id,
    webhook_url,
    is_active,
    expires_at,
    created_at
) VALUES (
    '72f250e8-1669-40bc-b84d-7fb24c76b4c9',
    'mqWFmR5RrOzuxUts4pyf9x3Sdec',
    '1zXaSqUi0jltR0QSJ9LViiQCaTMhgqabp', -- Reemplazar con folder_id real
    'USER_ID_AQUI', -- Reemplazar con user_id real
    'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135',
    true,
    '2025-09-02 02:54:23+00', -- Fecha de expiración del header
    NOW()
);
*/

-- 5. Verificar que se creó correctamente
SELECT 
    dwc.*,
    u.email as user_email,
    ca.plan_name
FROM drive_watch_channels dwc
JOIN users u ON dwc.user_id = u.id
LEFT JOIN carpeta_administrador ca ON dwc.folder_id = ca.id_drive_carpeta
WHERE dwc.channel_id = '72f250e8-1669-40bc-b84d-7fb24c76b4c9';

-- 6. Si existe pero está inactivo, activarlo
/*
UPDATE drive_watch_channels 
SET is_active = true 
WHERE channel_id = '72f250e8-1669-40bc-b84d-7fb24c76b4c9';
*/

-- 7. Verificar user_credentials para el usuario del watch channel
SELECT 
    uc.user_id,
    u.email,
    CASE 
        WHEN uc.google_access_token IS NOT NULL THEN 'Token disponible'
        ELSE 'Token faltante'
    END as estado_token,
    uc.updated_at
FROM user_credentials uc
JOIN users u ON uc.user_id = u.id
JOIN drive_watch_channels dwc ON dwc.user_id = u.id
WHERE dwc.channel_id = '72f250e8-1669-40bc-b84d-7fb24c76b4c9';

-- INSTRUCCIONES:
-- 1. Ejecuta las consultas 1-3 para entender el estado actual
-- 2. Si el watch channel no existe, descomenta y modifica la consulta 4
-- 3. Ejecuta la consulta 5 para verificar
-- 4. Si está inactivo, descomenta y ejecuta la consulta 6
-- 5. Ejecuta la consulta 7 para verificar credenciales de Google