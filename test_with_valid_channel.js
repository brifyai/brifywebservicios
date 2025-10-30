// Script para probar con un channel ID válido que existe en la base de datos
const fetch = require('node-fetch');

// Usar el nuevo channel ID del usuario: b42801e5-ee16-4715-aa44-82d2e0ae8811
const notificationData = {
  headers: {
    "x-goog-channel-id": "b42801e5-ee16-4715-aa44-82d2e0ae8811",
    "x-goog-channel-expiration": "Tue, 02 Sep 2025 04:01:53 GMT",
    "x-goog-resource-state": "update",
    "x-goog-changed": "children",
    "x-goog-message-number": "320078",
    "x-goog-resource-id": "gEkbYsYLc9B6Y4gfjMWIcYaz1nI",
    "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/1LXqkJfpRtglkJdKhC7mvI8pEllcf0PVt?alt=json&null",
    "x-goog-channel-token": "35a8f0ef-4f07-4f18-b9f4-093656cb5c43"
  },
  body: {},
  processedData: {
    "channelId": "b42801e5-ee16-4715-aa44-82d2e0ae8811",
    "channelExpiration": "Tue, 02 Sep 2025 04:01:53 GMT",
    "resourceState": "update",
    "changedType": "children",
    "messageNumber": "320078",
    "resourceId": "gEkbYsYLc9B6Y4gfjMWIcYaz1nI",
    "resourceUri": "https://www.googleapis.com/drive/v3/files/1LXqkJfpRtglkJdKhC7mvI8pEllcf0PVt?alt=json&null",
    "channelToken": "35a8f0ef-4f07-4f18-b9f4-093656cb5c43",
    "timestamp": "2025-09-02T03:07:14.119Z",
    "changeType": "file_added_or_removed",
    "source": "n8n_webhook"
  }
};

async function testWithValidChannel() {
  try {
    console.log('🧪 Probando con channel ID válido...');
    console.log('📊 Channel ID usado (nuevo usuario):', notificationData.headers['x-goog-channel-id']);
    
    const response = await fetch('http://localhost:3001/api/webhook/drive-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationData)
    });
    
    console.log('📡 Status de respuesta:', response.status);
    console.log('📡 Status text:', response.statusText);
    
    const responseData = await response.text();
    console.log('📄 Respuesta del servidor:', responseData);
    
    if (response.ok) {
      console.log('✅ Notificación procesada exitosamente');
      try {
        const jsonResponse = JSON.parse(responseData);
        console.log('📋 Datos procesados:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log('⚠️ Respuesta no es JSON válido');
      }
    } else {
      console.log('❌ Error en el procesamiento');
      try {
        const errorData = JSON.parse(responseData);
        console.log('🔍 Detalles del error:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('🔍 Error sin formato JSON:', responseData);
      }
    }
    
  } catch (error) {
    console.error('💥 Error en la prueba:', error.message);
    console.error('🔍 Stack trace:', error.stack);
  }
}

// Ejecutar la prueba
testWithValidChannel();