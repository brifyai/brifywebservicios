// Script para probar con el channel ID específico del usuario
const fetch = require('node-fetch');

// Channel ID del usuario actual
const USER_CHANNEL_ID = 'b42801e5-ee16-4715-aa44-82d2e0ae8811';

// Simular notificación de Google Drive con el channel ID del usuario
function createUserNotification() {
  return {
    headers: {
      "x-goog-channel-id": USER_CHANNEL_ID,
      "x-goog-channel-expiration": "Tue, 02 Sep 2025 04:01:53 GMT",
      "x-goog-resource-state": "update",
      "x-goog-changed": "children",
      "x-goog-message-number": Math.floor(Math.random() * 1000000).toString(),
      "x-goog-resource-id": "gEkbYsYLc9B6Y4gfjMWIcYaz1nI",
      "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/1LXqkJfpRtglkJdKhC7mvI8pEllcf0PVt?alt=json&null",
      "x-goog-channel-token": "user-token-123"
    },
    body: {}
  };
}

// Procesar datos como lo haría n8n
function processNotification(webhookData) {
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
  
  let changeType = 'unknown';
  const { resourceState, changedType } = notificationInfo;
  
  if (resourceState === 'update' && changedType === 'children') {
    changeType = 'file_added_or_removed';
  } else if (resourceState === 'update' && changedType === 'properties') {
    changeType = 'file_modified';
  }
  
  return {
    headers: webhookData.headers,
    body: webhookData.body || {},
    processedData: {
      success: true,
      notificationInfo,
      changeType,
      timestamp: notificationInfo.timestamp,
      source: 'n8n_webhook'
    },
    timestamp: new Date().toISOString()
  };
}

// Probar el endpoint
async function testUserChannel() {
  console.log('🧪 Probando con el Channel ID del usuario:', USER_CHANNEL_ID);
  console.log('=' .repeat(60));
  
  // Crear notificación simulada
  const webhookData = createUserNotification();
  console.log('📨 Datos del webhook creados');
  
  // Procesar como n8n
  const processedData = processNotification(webhookData);
  console.log('⚙️ Datos procesados por n8n');
  
  console.log('📊 Estructura de datos a enviar:');
  console.log(JSON.stringify(processedData, null, 2));
  
  try {
    console.log('\n📡 Enviando a la aplicación web...');
    const response = await fetch('http://localhost:3001/api/webhook/drive-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(processedData)
    });
    
    console.log('📡 Status de respuesta:', response.status);
    const responseData = await response.text();
    console.log('📄 Respuesta del servidor:', responseData);
    
    if (response.ok) {
      console.log('✅ ¡Éxito! La notificación fue procesada correctamente');
      try {
        const jsonResponse = JSON.parse(responseData);
        if (jsonResponse.data?.notificationId) {
          console.log('🆔 ID de notificación guardada:', jsonResponse.data.notificationId);
        }
      } catch (e) {
        // Respuesta no es JSON, pero fue exitosa
      }
    } else {
      console.log('❌ Error en el procesamiento');
      
      if (response.status === 404) {
        console.log('\n💡 SOLUCIÓN: El channel ID no existe en la base de datos.');
        console.log('   Necesitas ejecutar el script SQL para crear el watch channel:');
        console.log('   1. Abre Supabase SQL Editor');
        console.log('   2. Ejecuta check_active_channels.sql para ver channels existentes');
        console.log('   3. Si no existe, crea el channel manualmente o mediante la compra de un plan');
      }
    }
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('\n💡 VERIFICAR: ¿Está corriendo el servidor en puerto 3001?');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Ejecutar la prueba
testUserChannel();