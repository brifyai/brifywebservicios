// Código para integrar en n8n - Nodo de código JavaScript
// Este código debe colocarse en un nodo "Code" después del webhook trigger

// ============================================================================
// OPCIÓN 1: Código completo para n8n (recomendado)
// ============================================================================

// Función para procesar notificaciones de Google Drive
async function processGoogleDriveNotification(webhookData) {
  console.log('🎯 Procesando notificación de Google Drive en n8n:', JSON.stringify(webhookData, null, 2));
  
  try {
    // Validar que tenemos los datos necesarios
    if (!webhookData || !webhookData.headers) {
      throw new Error('Datos de webhook inválidos: faltan headers');
    }
    
    // Verificar que es una notificación de Google Drive
    const channelId = webhookData.headers['x-goog-channel-id'];
    if (!channelId) {
      throw new Error('No es una notificación válida de Google Drive: falta x-goog-channel-id');
    }
    
    // Extraer información de los headers
    const notificationInfo = {
      channelId: webhookData.headers['x-goog-channel-id'],
      channelExpiration: webhookData.headers['x-goog-channel-expiration'],
      resourceState: webhookData.headers['x-goog-resource-state'],
      changedType: webhookData.headers['x-goog-changed'],
      messageNumber: webhookData.headers['x-goog-message-number'],
      resourceId: webhookData.headers['x-goog-resource-id'],
      resourceUri: webhookData.headers['x-goog-resource-uri'],
      channelToken: webhookData.headers['x-goog-channel-token'],
      timestamp: new Date().toISOString()
    };
    
    // Determinar el tipo de cambio
    let changeType = 'unknown';
    const { resourceState, changedType } = notificationInfo;
    
    if (resourceState === 'update' && changedType === 'children') {
      changeType = 'file_added_or_removed';
    } else if (resourceState === 'update' && changedType === 'properties') {
      changeType = 'file_modified';
    } else if (resourceState === 'update' && changedType === 'permissions') {
      changeType = 'permissions_changed';
    } else if (resourceState === 'trash') {
      changeType = 'file_trashed';
    }
    
    console.log(`🔍 Tipo de cambio detectado: ${changeType}`);
    
    // Preparar datos para enviar a la aplicación principal
    const processedData = {
      success: true,
      notificationInfo,
      changeType,
      timestamp: notificationInfo.timestamp,
      source: 'n8n_webhook'
    };
    
    // Log para debugging
    console.log('✅ Notificación procesada exitosamente:', processedData);
    
    // Preparar datos para envío a la aplicación web
    const dataToSend = {
      headers: webhookData.headers,
      body: webhookData.body || {},
      processedData,
      timestamp: new Date().toISOString()
    };
    
    console.log('📝 Datos preparados para envío a aplicación web:', dataToSend);
    
    // IMPORTANTE: Los datos están listos para ser enviados por el nodo HTTP Request
    // El nodo HTTP Request debe configurarse para enviar estos datos a:
    // URL: http://localhost:3001/api/webhook/drive-notifications
    // Método: POST
    // Headers: Content-Type: application/json
    processedData.readyForHttpRequest = true;
    processedData.webAppData = dataToSend;
    
    return processedData;
    
  } catch (error) {
    console.error('❌ Error procesando notificación:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      source: 'n8n_webhook'
    };
  }
}

// ============================================================================
// CÓDIGO PRINCIPAL PARA N8N
// ============================================================================

// Obtener los datos del webhook
let webhookData = $input.all()[0].json;

// Si los datos vienen en un array, tomar el primer elemento
if (Array.isArray(webhookData) && webhookData.length > 0) {
  webhookData = webhookData[0];
}

// Procesar la notificación
const result = await processGoogleDriveNotification(webhookData);

// Retornar el resultado para el siguiente nodo
return {
  json: {
    ...result,
    originalWebhookData: webhookData,
    processedAt: new Date().toISOString()
  }
};

// ============================================================================
// OPCIÓN 2: Código simplificado para n8n (alternativo)
// ============================================================================

/*
// Versión más simple si prefieres menos código en n8n
const webhookData = $input.all()[0].json;

// Extraer información básica
const headers = webhookData.headers || {};
const channelId = headers['x-goog-channel-id'];
const resourceState = headers['x-goog-resource-state'];
const changedType = headers['x-goog-changed'];

// Determinar tipo de cambio básico
let changeType = 'unknown';
if (resourceState === 'update' && changedType === 'children') {
  changeType = 'file_added_or_removed';
}

// Retornar datos procesados
return {
  json: {
    success: true,
    channelId,
    resourceState,
    changedType,
    changeType,
    timestamp: new Date().toISOString(),
    headers: headers
  }
};
*/

// ============================================================================
// CONFIGURACIÓN DEL WORKFLOW N8N
// ============================================================================

/*
PARA CONFIGURAR EL WORKFLOW EN N8N:

1. WEBHOOK TRIGGER:
   - Método: POST (IMPORTANTE: cambiar de GET a POST)
   - URL: https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135
   - Respuesta: 200 OK

2. CODE NODE (este código):
   - Lenguaje: JavaScript
   - Pegar el código de arriba

3. CONDITIONAL NODE (opcional):
   - Condición: {{ $json.success }} === true
   - Ruta TRUE: procesar notificación
   - Ruta FALSE: manejar error

4. HTTP REQUEST NODE (para notificar a la app):
   - Método: POST
   - URL: https://tu-app.com/api/drive-notification
   - Body: {{ $json }}

5. SET NODE (para logging):
   - Guardar en base de datos o enviar a logs

EJEMPLO DE RESPUESTA ESPERADA:
{
  "success": true,
  "notificationInfo": {
    "channelId": "6e32b6bc-2f15-471d-9e25-8c74cb17af36",
    "resourceState": "update",
    "changedType": "children",
    "changeType": "file_added_or_removed"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
*/