# Solución: Output Vacío en Code Node para Nuevo Usuario

## 🔍 Diagnóstico del Problema

El Code Node de n8n devuelve output vacío para el nuevo usuario porque:

1. **El webhook recibe la llamada** ✅
2. **Pero no se registra la notificación** ❌
3. **El Code Node devuelve output vacío** ❌

## 🎯 Causas Más Probables

### 1. **Usuario sin Watch Channel Activo**
- El nuevo usuario no ha comprado un plan
- No se ha creado el watch channel en Google Drive
- El watch channel existe pero está inactivo

### 2. **Configuración Incorrecta del Webhook**
- URL del webhook incorrecta en n8n
- Google Drive no está enviando datos al webhook
- Headers de Google Drive no llegan al Code Node

### 3. **Datos Vacíos o Malformados**
- Google Drive envía objeto vacío `{}`
- Headers de Google Drive están ausentes
- Channel ID vacío o inválido

## 🛠️ Pasos de Solución

### Paso 1: Verificar Setup del Usuario

```sql
-- Ejecutar en Supabase para verificar el usuario
SELECT 
    u.email,
    dwc.id as channel_id,
    dwc.is_active,
    dwc.webhook_url,
    ca.nombre_carpeta
FROM auth.users u
LEFT JOIN drive_watch_channels dwc ON u.id = dwc.user_id
LEFT JOIN carpeta_administrador ca ON u.id = ca.user_id
WHERE u.email = 'EMAIL_DEL_NUEVO_USUARIO'
ORDER BY u.created_at DESC;
```

### Paso 2: Implementar Debug en n8n

1. **Reemplazar el Code Node actual** con el contenido de `n8n_debug_version.js`
2. **Ejecutar una prueba** subiendo un archivo a Google Drive
3. **Revisar los logs** en n8n para ver exactamente qué datos llegan

### Paso 3: Verificar Webhook de Google Drive

```javascript
// Código para verificar en el navegador (consola de la aplicación)
const testWebhook = async () => {
  try {
    const response = await fetch('/api/user/watch-channels');
    const channels = await response.json();
    console.log('Watch channels del usuario:', channels);
    
    if (channels.length === 0) {
      console.log('❌ PROBLEMA: Usuario no tiene watch channels');
      console.log('💡 SOLUCIÓN: Usuario debe comprar un plan');
    } else {
      channels.forEach(channel => {
        console.log(`Channel ID: ${channel.id}`);
        console.log(`Activo: ${channel.is_active}`);
        console.log(`Webhook URL: ${channel.webhook_url}`);
        console.log(`Expira: ${channel.expires_at}`);
      });
    }
  } catch (error) {
    console.error('Error verificando channels:', error);
  }
};

testWebhook();
```

### Paso 4: Soluciones Específicas

#### Si el usuario NO tiene watch channels:
```javascript
// El usuario debe comprar un plan primero
// Verificar que el proceso de compra cree el watch channel correctamente
```

#### Si el usuario TIENE watch channels pero están inactivos:
```sql
-- Reactivar el watch channel
UPDATE drive_watch_channels 
SET is_active = true 
WHERE user_id = 'USER_ID_AQUI';
```

#### Si el webhook URL es incorrecto:
```sql
-- Actualizar la URL del webhook
UPDATE drive_watch_channels 
SET webhook_url = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/drive-notifications'
WHERE user_id = 'USER_ID_AQUI';
```

### Paso 5: Crear Watch Channel Manualmente (Si es necesario)

```sql
-- Solo si el usuario no tiene watch channel y ya compró un plan
INSERT INTO drive_watch_channels (
    id,
    user_id,
    folder_id,
    webhook_url,
    is_active,
    expires_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'USER_ID_DEL_NUEVO_USUARIO',
    'FOLDER_ID_DE_LA_CARPETA_ADMIN',
    'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/drive-notifications',
    true,
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW()
);
```

## 🧪 Pruebas de Verificación

### 1. Probar con el Debug Code Node
```javascript
// Usar n8n_debug_version.js y revisar logs
// Debe mostrar exactamente qué datos llegan
```

### 2. Probar el endpoint directamente
```javascript
// Usar test_user_channel.js con el channel ID del nuevo usuario
node test_user_channel.js
```

### 3. Verificar notificaciones en la base de datos
```sql
SELECT * FROM drive_notifications 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## 📋 Checklist de Verificación

- [ ] Usuario tiene watch channel activo en la base de datos
- [ ] Watch channel tiene la URL correcta de n8n
- [ ] Watch channel no está expirado
- [ ] Google Drive está configurado para enviar notificaciones
- [ ] n8n recibe las llamadas del webhook
- [ ] Code Node procesa los datos correctamente
- [ ] Endpoint de la aplicación recibe y guarda las notificaciones

## 🚨 Acciones Inmediatas

1. **Ejecutar** `check_new_user_setup.sql` en Supabase
2. **Reemplazar** Code Node con `n8n_debug_version.js`
3. **Probar** subiendo un archivo a Google Drive
4. **Revisar** logs de n8n para identificar el problema exacto
5. **Aplicar** la solución específica según los resultados

## 💡 Prevención Futura

- Agregar validación en el proceso de compra para asegurar que el watch channel se cree correctamente
- Implementar monitoreo automático de watch channels expirados
- Agregar logs detallados en el Code Node por defecto
- Crear endpoint de diagnóstico para usuarios