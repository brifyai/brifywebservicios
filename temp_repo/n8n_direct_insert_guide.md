# Guía para Inserción Directa en drive_notifications desde n8n

## Problema Resuelto
En lugar de usar el endpoint de código, haremos la inserción directamente desde n8n usando un nodo de Supabase.

## Estructura de la Tabla drive_notifications
```sql
CREATE TABLE drive_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id TEXT NOT NULL,
    resource_id TEXT,
    resource_state TEXT,
    event_type TEXT,
    user_id UUID,
    folder_id TEXT,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    changed_files JSONB,
    resource_uri TEXT,
    notification_data JSONB,
    processed_at TIMESTAMPTZ
);
```

## Datos que Recibes del Webhook
Cuando Google Drive envía el webhook, recibes estos headers:

```javascript
{
  "x-goog-channel-id": "d53c2c7a-22c9-4afb-8f01-2df3ad8273af",
  "x-goog-channel-expiration": "Tue, 02 Sep 2025 04:01:53 GMT",
  "x-goog-resource-state": "update", // o "sync"
  "x-goog-message-number": "910879",
  "x-goog-resource-id": "k-JJvlGMbp2XtnU7ZmH6RGRsVhA",
  "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/1y-VHDmIi3j4VxAp7gduTEy4zHAG_XL-H?alt=json&null",
  "x-goog-channel-token": "d53c2c7a-22c9-4afb-8f01-2df3ad8273af"
}
```

## Configuración del Nodo Supabase en n8n

### 1. Nodo de Procesamiento (Code Node)
```javascript
// Extraer datos del webhook
const headers = $input.all()[0].json.headers;

// Datos principales
const channelId = headers['x-goog-channel-id'];
const resourceState = headers['x-goog-resource-state'];
const resourceId = headers['x-goog-resource-id'];
const resourceUri = headers['x-goog-resource-uri'];
const messageNumber = headers['x-goog-message-number'];

// Extraer folder_id de la URI
const folderIdMatch = resourceUri.match(/files\/([^?]+)/);
const folderId = folderIdMatch ? folderIdMatch[1] : null;

// Determinar tipo de evento
let eventType = 'unknown';
if (resourceState === 'update') {
  eventType = 'file_changed';
} else if (resourceState === 'sync') {
  eventType = 'sync';
}

// Preparar datos para inserción
const notificationData = {
  channel_id: channelId,
  resource_id: resourceId,
  resource_state: resourceState,
  event_type: eventType,
  folder_id: folderId,
  resource_uri: resourceUri,
  notification_data: {
    headers: headers,
    message_number: messageNumber,
    timestamp: new Date().toISOString(),
    source: 'n8n_direct'
  },
  processed: false
};

return [notificationData];
```

### 2. Nodo Supabase (Insert)
**Configuración:**
- **Operation:** Insert
- **Table:** drive_notifications
- **Columns to Send:** All

**Mapeo de Campos:**
```json
{
  "channel_id": "{{ $json.channel_id }}",
  "resource_id": "{{ $json.resource_id }}",
  "resource_state": "{{ $json.resource_state }}",
  "event_type": "{{ $json.event_type }}",
  "folder_id": "{{ $json.folder_id }}",
  "resource_uri": "{{ $json.resource_uri }}",
  "notification_data": "{{ $json.notification_data }}",
  "processed": false
}
```

## Identificar Qué Archivo Cambió

Para saber exactamente qué archivo se subió/actualizó, necesitas hacer una consulta adicional a Google Drive API:

### 3. Nodo HTTP Request (Google Drive API)
```javascript
// En el Code Node, después de extraer los datos básicos:
const accessToken = 'TU_ACCESS_TOKEN'; // Desde tu configuración

// Si tienes el folder_id, puedes consultar los archivos
const driveApiUrl = `https://www.googleapis.com/drive/v3/files?q=parents in '${folderId}'&orderBy=modifiedTime desc&pageSize=5`;

return [{
  url: driveApiUrl,
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  folderId: folderId,
  channelId: channelId
}];
```

### 4. Procesar Respuesta de Drive API
```javascript
// Code Node para procesar la respuesta
const driveResponse = $input.all()[0].json;
const files = driveResponse.files || [];

// El archivo más reciente probablemente es el que cambió
const mostRecentFile = files[0];

if (mostRecentFile) {
  return [{
    file_id: mostRecentFile.id,
    file_name: mostRecentFile.name,
    file_modified: mostRecentFile.modifiedTime,
    file_size: mostRecentFile.size,
    mime_type: mostRecentFile.mimeType,
    // Datos originales del webhook
    channel_id: $node["Code"].json.channelId,
    resource_id: $node["Code"].json.resourceId,
    change_detected: true
  }];
} else {
  return [{
    channel_id: $node["Code"].json.channelId,
    resource_id: $node["Code"].json.resourceId,
    change_detected: false,
    error: 'No files found in folder'
  }];
}
```

## Flujo Completo en n8n

1. **Webhook Trigger** → Recibe notificación de Google Drive
2. **Code Node** → Extrae datos del webhook
3. **Supabase Insert** → Guarda notificación básica
4. **HTTP Request** → Consulta Google Drive API para detalles del archivo
5. **Code Node** → Procesa respuesta de Drive API
6. **Supabase Update** → Actualiza la notificación con detalles del archivo

## Ventajas de Este Enfoque

✅ **Más directo:** No depende del endpoint de código
✅ **Más control:** Puedes ver exactamente qué se está insertando
✅ **Más flexible:** Puedes agregar lógica adicional fácilmente
✅ **Mejor debugging:** n8n te muestra cada paso del proceso

## Datos Importantes para el user_id

Para obtener el `user_id`, necesitas hacer un JOIN con la tabla `drive_watch_channels`:

```sql
SELECT 
    dn.*,
    dwc.user_id,
    dwc.folder_id as watch_folder_id
FROM drive_notifications dn
JOIN drive_watch_channels dwc ON dn.channel_id = dwc.channel_id
WHERE dn.channel_id = 'd53c2c7a-22c9-4afb-8f01-2df3ad8273af';
```

O puedes hacer esto directamente en n8n con otro nodo Supabase que haga el SELECT del user_id basado en el channel_id.