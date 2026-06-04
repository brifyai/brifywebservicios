# Configuración del Nodo HTTP Request en n8n

## Problema Identificado
Las funciones `fetch` y `$http.request` no están disponibles en el entorno de código JavaScript de n8n. La solución es usar un nodo HTTP Request separado.

## Configuración del Workflow n8n

### 1. Webhook Trigger
- **Método**: POST
- **URL**: https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135
- **Respuesta**: 200 OK

### 2. Code Node (JavaScript)
- **Lenguaje**: JavaScript
- **Código**: Usar el código actualizado de `n8n_webhook_integration.js`
- **Función**: Procesar y estructurar los datos de la notificación

### 3. HTTP Request Node
- **Método**: POST
- **URL**: `http://localhost:3001/api/webhook/drive-notifications`
- **Headers**:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```

#### Body (JSON) - DINÁMICO
Usa la siguiente expresión para enviar los datos procesados dinámicamente:
```javascript
{{ $json.webAppData }}
```

**O si prefieres más control, usa esta estructura:**
```javascript
{{
  {
    "headers": $json.originalWebhookData.headers,
    "body": $json.originalWebhookData.body || {},
    "processedData": {
      "channelId": $json.notificationInfo.channelId,
      "resourceState": $json.notificationInfo.resourceState,
      "changedType": $json.notificationInfo.changedType,
      "changeType": $json.changeType,
      "timestamp": $json.timestamp,
      "source": "n8n_webhook"
    }
  }
}}
```

### 4. Conditional Node (Opcional)
- **Condición**: `{{ $json.success }} === true`
- **Ruta TRUE**: Continuar al HTTP Request
- **Ruta FALSE**: Manejar error

## Datos que se Enviarán

El nodo HTTP Request enviará:

```json
{
  "headers": {
    "x-goog-channel-id": "6118bc3b-fe98-4597-badb-dd0fabb167dd",
    "x-goog-resource-state": "update",
    "x-goog-changed": "children",
    "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/...",
    // ... otros headers
  },
  "body": {},
  "processedData": {
    "success": true,
    "notificationInfo": {
      "channelId": "6118bc3b-fe98-4597-badb-dd0fabb167dd",
      "resourceState": "update",
      "changedType": "children",
      "changeType": "file_added_or_removed"
    },
    "timestamp": "2025-09-02T03:07:14.119Z",
    "source": "n8n_webhook"
  },
  "timestamp": "2025-09-02T03:07:14.119Z"
}
```

## Verificación

1. **Logs del Code Node**: Verificar que los datos se procesan correctamente
2. **Logs del HTTP Request**: Verificar que la petición se envía sin errores
3. **Base de datos**: Verificar que la notificación se guarda en `drive_notifications`

## Troubleshooting

- Si el HTTP Request falla, verificar que el servidor Express esté corriendo en puerto 3001
- Si hay errores de CORS, verificar la configuración en `server.js`
- Si hay errores de foreign key, verificar que el `channel_id` existe en `drive_watch_channels`