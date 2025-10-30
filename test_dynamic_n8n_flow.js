// Script para simular el flujo completo de n8n con datos dinámicos
const fetch = require('node-fetch');

// Simular datos que llegarían desde Google Drive (dinámicos)
function createDynamicNotification(channelId) {
  return {
    headers: {
      "x-goog-channel-id": channelId,
      "x-goog-channel-expiration": "Tue, 02 Sep 2025 04:01:53 GMT",
      "x-goog-resource-state": "update",
      "x-goog-changed": "children",
      "x-goog-message-number": Math.floor(Math.random() * 1000000).toString(),
      "x-goog-resource-id": "gEkbYsYLc9B6Y4gfjMWIcYaz1nI",
      "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/1LXqkJfpRtglkJdKhC7mvI8pEllcf0PVt?alt=json&null",
      "x-goog-channel-token": "35a8f0ef-4f07-4f18-b9f4-093656cb5c43"
    },
    body: {}
  };
}

// Simular el procesamiento que hace el Code Node de n8n
function simulateN8nCodeNode(webhookData) {
  console.log('🎯 Simulando Code Node de n8n...');
  
  // Extraer información de los headers (dinámicamente)
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
  
  // Determinar tipo de cambio
  let changeType = 'unknown';
  const { resourceState, changedType } = notificationInfo;
  
  if (resourceState === 'update' && changedType === 'children') {
    changeType = 'file_added_or_removed';
  } else if (resourceState === 'update' && changedType === 'properties') {
    changeType = 'file_modified';
  }
  
  // Preparar datos para HTTP Request Node
  const processedData = {
    success: true,
    notificationInfo,
    changeType,
    timestamp: notificationInfo.timestamp,
    source: 'n8n_webhook'
  };
  
  const webAppData = {
    headers: webhookData.headers,
    body: webhookData.body || {},
    processedData,
    timestamp: new Date().toISOString()
  };
  
  return {
    ...processedData,
    originalWebhookData: webhookData,
    webAppData: webAppData,
    readyForHttpRequest: true
  };
}

// Simular el HTTP Request Node enviando a la aplicación web
async function simulateHttpRequestNode(n8nOutput) {
  console.log('📡 Simulando HTTP Request Node...');
  console.log('📊 Datos a enviar:', JSON.stringify(n8nOutput.webAppData, null, 2));
  
  try {
    const response = await fetch('http://localhost:3001/api/webhook/drive-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nOutput.webAppData)
    });
    
    console.log('📡 Status de respuesta:', response.status);
    const responseData = await response.text();
    console.log('📄 Respuesta del servidor:', responseData);
    
    return {
      success: response.ok,
      status: response.status,
      data: responseData
    };
    
  } catch (error) {
    console.error('❌ Error en HTTP Request Node:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Función principal para probar el flujo completo
async function testDynamicFlow() {
  console.log('🚀 Iniciando prueba del flujo dinámico de n8n...');
  console.log('=' .repeat(60));
  
  // Probar con diferentes channel IDs
  const testChannelIds = [
    'b42801e5-ee16-4715-aa44-82d2e0ae8811', // Tu nuevo channel ID
    '96536a5c-1824-4452-a732-c0bb4e5cd08b'  // Channel ID anterior (si existe)
  ];
  
  for (const channelId of testChannelIds) {
    console.log(`\n🧪 Probando con Channel ID: ${channelId}`);
    console.log('-'.repeat(50));
    
    // 1. Simular webhook de Google Drive
    const webhookData = createDynamicNotification(channelId);
    console.log('📨 Webhook recibido de Google Drive');
    
    // 2. Simular Code Node de n8n
    const n8nOutput = simulateN8nCodeNode(webhookData);
    console.log('⚙️ Datos procesados por Code Node');
    
    // 3. Simular HTTP Request Node
    const result = await simulateHttpRequestNode(n8nOutput);
    
    if (result.success) {
      console.log('✅ Flujo completado exitosamente');
      try {
        const jsonResponse = JSON.parse(result.data);
        console.log('📋 Notificación guardada:', jsonResponse.data?.notificationId);
      } catch (e) {
        console.log('📋 Respuesta procesada correctamente');
      }
    } else {
      console.log('❌ Error en el flujo:', result.error || result.data);
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Ejecutar la prueba
testDynamicFlow();