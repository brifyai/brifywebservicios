// Script para n8n Code Node - Detectar archivo específico que cambió
// Copia este código en un Code Node de n8n

// ===== PASO 1: EXTRAER DATOS DEL WEBHOOK =====
const webhookData = $input.all()[0].json;
const headers = webhookData.headers || {};

// Datos principales del webhook
const channelId = headers['x-goog-channel-id'];
const resourceState = headers['x-goog-resource-state'];
const resourceId = headers['x-goog-resource-id'];
const resourceUri = headers['x-goog-resource-uri'];
const messageNumber = headers['x-goog-message-number'];
const channelToken = headers['x-goog-channel-token'];

// ===== PASO 2: EXTRAER FOLDER ID DE LA URI =====
let folderId = null;
if (resourceUri) {
  // Extraer folder ID de diferentes formatos de URI
  const folderMatch = resourceUri.match(/files\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    folderId = folderMatch[1];
  }
}

// ===== PASO 3: DETERMINAR TIPO DE CAMBIO =====
let changeType = 'unknown';
let actionDescription = 'Cambio desconocido';

switch (resourceState) {
  case 'update':
    changeType = 'file_modified';
    actionDescription = 'Archivo modificado o agregado';
    break;
  case 'sync':
    changeType = 'sync';
    actionDescription = 'Sincronización inicial';
    break;
  case 'exists':
    changeType = 'file_exists';
    actionDescription = 'Archivo existe';
    break;
  default:
    changeType = resourceState || 'unknown';
    actionDescription = `Estado: ${resourceState}`;
}

// ===== PASO 4: PREPARAR DATOS PARA GOOGLE DRIVE API =====
// Configuración para consultar archivos recientes
const driveApiConfig = {
  // Consultar archivos modificados en los últimos 5 minutos
  timeFilter: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  
  // Query para Google Drive API
  query: folderId ? 
    `parents in '${folderId}' and modifiedTime > '${new Date(Date.now() - 5 * 60 * 1000).toISOString()}'` :
    `modifiedTime > '${new Date(Date.now() - 5 * 60 * 1000).toISOString()}'`,
    
  // URL completa para la API
  apiUrl: `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    folderId ? 
      `parents in '${folderId}' and modifiedTime > '${new Date(Date.now() - 5 * 60 * 1000).toISOString()}'` :
      `modifiedTime > '${new Date(Date.now() - 5 * 60 * 1000).toISOString()}'
  )}&orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,modifiedTime,size,mimeType,parents,createdTime,owners)`
};

// ===== PASO 5: DATOS PARA INSERCIÓN EN SUPABASE =====
const supabaseData = {
  // Campos principales
  channel_id: channelId,
  resource_id: resourceId,
  resource_state: resourceState,
  event_type: changeType,
  folder_id: folderId,
  resource_uri: resourceUri,
  
  // Datos adicionales en JSONB
  notification_data: {
    webhook_headers: headers,
    message_number: messageNumber,
    channel_token: channelToken,
    timestamp: new Date().toISOString(),
    source: 'n8n_direct_insert',
    action_description: actionDescription,
    detection_method: 'webhook_notification'
  },
  
  // Estado inicial
  processed: false
};

// ===== PASO 6: DATOS PARA DEBUG =====
const debugInfo = {
  webhook_received: {
    channel_id: channelId,
    resource_state: resourceState,
    folder_id: folderId,
    change_type: changeType,
    action: actionDescription
  },
  
  api_query_prepared: {
    query: driveApiConfig.query,
    api_url: driveApiConfig.apiUrl,
    time_filter: driveApiConfig.timeFilter
  },
  
  next_steps: [
    '1. Insertar notificación en drive_notifications',
    '2. Consultar Google Drive API para detalles del archivo',
    '3. Actualizar notificación con información del archivo',
    '4. Marcar como procesado'
  ]
};

// ===== RETORNO PARA N8N =====
return [
  {
    // Para inserción directa en Supabase
    supabase_insert: supabaseData,
    
    // Para consulta a Google Drive API
    drive_api_config: driveApiConfig,
    
    // Para debugging
    debug: debugInfo,
    
    // Datos originales por si los necesitas
    original_webhook: webhookData,
    
    // Indicadores de estado
    status: {
      webhook_processed: true,
      folder_id_extracted: !!folderId,
      change_type_determined: changeType !== 'unknown',
      ready_for_api_call: !!folderId && !!channelId
    }
  }
];

// ===== NOTAS DE USO =====
/*
Este script te da:

1. supabase_insert: Datos listos para insertar en drive_notifications
2. drive_api_config: Configuración para consultar Google Drive API
3. debug: Información para debugging
4. status: Indicadores de qué se pudo extraer

Flujo recomendado en n8n:
1. Webhook → Este Code Node
2. Supabase Insert (usar supabase_insert)
3. HTTP Request a Google Drive (usar drive_api_config.apiUrl)
4. Code Node para procesar respuesta de Drive API
5. Supabase Update con detalles del archivo

Para identificar el archivo específico:
- El webhook te dice QUE carpeta cambió
- La consulta a Drive API te dice QUE archivo cambió
- Filtrando por tiempo (últimos 5 min) reduces las opciones
- El archivo más reciente es probablemente el que causó la notificación
*/