// Script para probar el endpoint API con el channel ID real
// Channel ID: 6cf57f59-1778-4cf2-a32a-df2a9f84461b

const testRealChannelNotification = async () => {
  const testData = {
    headers: {
      'x-goog-channel-id': 'd53c2c7a-22c9-4afb-8f01-2df3ad8273af',
      'x-goog-channel-expiration': 'Tue, 02 Sep 2025 04:01:53 GMT',
      'x-goog-resource-state': 'update',
      'x-goog-changed': 'children',
      'x-goog-message-number': '910879',
      'x-goog-resource-id': 'k-JJvlGMbp2XtnU7ZmH6RGRsVhA',
      'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/1y-VHDmIi3j4VxAp7gduTEy4zHAG_XL-H?alt=json&null',
      'x-goog-channel-token': 'd53c2c7a-22c9-4afb-8f01-2df3ad8273af'
    },
    body: {
      messageNumber: '910879',
      resourceId: 'k-JJvlGMbp2XtnU7ZmH6RGRsVhA',
      resourceUri: 'https://www.googleapis.com/drive/v3/files/1y-VHDmIi3j4VxAp7gduTEy4zHAG_XL-H?alt=json&null',
      channelToken: 'd53c2c7a-22c9-4afb-8f01-2df3ad8273af',
      timestamp: '2025-09-02T03:34:21.524Z'
    },
    processedData: {
      success: true,
      notificationInfo: {
        channelId: 'd53c2c7a-22c9-4afb-8f01-2df3ad8273af',
        resourceState: 'update',
        changedType: 'children',
        timestamp: '2025-09-02T03:34:21.524Z'
      },
      changeType: 'file_added_or_removed',
      timestamp: '2025-09-02T03:34:21.524Z',
      source: 'n8n_webhook'
    },
    timestamp: '2025-09-02T03:34:21.524Z',
    readyForHttpRequest: true,
    processedAt: '2025-09-02T03:34:21.524Z',
    debug: {
      inputDataLength: 1,
      webhookDataKeys: ['headers', 'params', 'query', 'body', 'webhookUrl', 'executionMode'],
      headersFound: 17,
      channelIdFound: true
    }
  };

  try {
    console.log('🚀 Enviando notificación con channel ID real:', testData.headers['x-goog-channel-id']);
    
    const response = await fetch('http://localhost:3001/api/webhook/drive-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('📊 Status:', response.status);
    console.log('📋 Respuesta:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Notificación procesada exitosamente');
    } else {
      console.log('❌ Error procesando notificación:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Error en la petición:', error.message);
  }
};

// Ejecutar la prueba
testRealChannelNotification();

console.log('📝 INSTRUCCIONES:');
console.log('1. Asegúrate de que el servidor esté ejecutándose en puerto 3001');
console.log('2. Ejecuta: node test_real_channel_6cf57f59.js');
console.log('3. Verifica que el watch channel existe en Supabase con verify_channel_6cf57f59.sql');
console.log('4. Si no existe, créalo usando el script SQL');
console.log('5. Vuelve a ejecutar esta prueba');