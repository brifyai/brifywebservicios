// Script para simular exactamente lo que Google Drive envía al webhook de n8n
const fetch = require('node-fetch');

// Simular diferentes formatos de datos que Google Drive podría enviar
const testCases = [
  {
    name: 'Formato 1: Headers en el nivel raíz',
    data: {
      'x-goog-channel-id': 'test-channel-123',
      'x-goog-channel-expiration': 'Tue, 02 Sep 2025 04:01:53 GMT',
      'x-goog-resource-state': 'update',
      'x-goog-changed': 'children',
      'x-goog-message-number': '12345',
      'x-goog-resource-id': 'test-resource-id',
      'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/test-file-id?alt=json',
      'x-goog-channel-token': 'test-token'
    }
  },
  {
    name: 'Formato 2: Headers en objeto headers',
    data: {
      headers: {
        'x-goog-channel-id': 'test-channel-123',
        'x-goog-channel-expiration': 'Tue, 02 Sep 2025 04:01:53 GMT',
        'x-goog-resource-state': 'update',
        'x-goog-changed': 'children',
        'x-goog-message-number': '12345',
        'x-goog-resource-id': 'test-resource-id',
        'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/test-file-id?alt=json',
        'x-goog-channel-token': 'test-token'
      },
      body: {}
    }
  },
  {
    name: 'Formato 3: Headers en body.headers',
    data: {
      body: {
        headers: {
          'x-goog-channel-id': 'test-channel-123',
          'x-goog-channel-expiration': 'Tue, 02 Sep 2025 04:01:53 GMT',
          'x-goog-resource-state': 'update',
          'x-goog-changed': 'children',
          'x-goog-message-number': '12345',
          'x-goog-resource-id': 'test-resource-id',
          'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/test-file-id?alt=json',
          'x-goog-channel-token': 'test-token'
        }
      }
    }
  },
  {
    name: 'Formato 4: Datos vacíos (caso problemático)',
    data: {}
  },
  {
    name: 'Formato 5: Solo body sin headers',
    data: {
      body: {
        someData: 'test'
      }
    }
  }
];

// Función para simular el procesamiento del Code Node
function simulateN8nCodeNode(testCase) {
  console.log(`\n🧪 Probando: ${testCase.name}`);
  console.log('📥 Datos de entrada:', JSON.stringify(testCase.data, null, 2));
  
  try {
    // Simular $input.all()[0].json
    const webhookData = testCase.data;
    
    if (!webhookData) {
      throw new Error('webhookData es null o undefined');
    }
    
    console.log('📋 webhookData extraído:', JSON.stringify(webhookData, null, 2));
    console.log('📝 Tipo de webhookData:', typeof webhookData);
    console.log('📝 Keys de webhookData:', Object.keys(webhookData));
    
    // Buscar headers en diferentes ubicaciones
    let headers = null;
    
    if (webhookData.headers) {
      headers = webhookData.headers;
      console.log('✅ Headers encontrados en webhookData.headers');
    } else if (webhookData.body && webhookData.body.headers) {
      headers = webhookData.body.headers;
      console.log('✅ Headers encontrados en webhookData.body.headers');
    } else {
      // Buscar headers de Google Drive directamente en el objeto
      const googleHeaders = {};
      for (const key in webhookData) {
        if (key.startsWith('x-goog-')) {
          googleHeaders[key] = webhookData[key];
        }
      }
      
      if (Object.keys(googleHeaders).length > 0) {
        headers = googleHeaders;
        console.log('✅ Headers de Google Drive encontrados directamente en webhookData');
      }
    }
    
    console.log('📋 Headers finales:', JSON.stringify(headers, null, 2));
    
    if (!headers) {
      throw new Error('No se encontraron headers');
    }
    
    const channelId = headers['x-goog-channel-id'];
    console.log('🆔 Channel ID encontrado:', channelId);
    
    if (!channelId) {
      throw new Error('No es una notificación válida de Google Drive');
    }
    
    // Procesar información
    const notificationInfo = {
      channelId: headers['x-goog-channel-id'],
      resourceState: headers['x-goog-resource-state'],
      changedType: headers['x-goog-changed'],
      timestamp: new Date().toISOString()
    };
    
    const result = {
      success: true,
      notificationInfo,
      webAppData: {
        headers: headers,
        body: webhookData.body || {},
        processedData: {
          success: true,
          notificationInfo,
          changeType: 'file_added_or_removed',
          timestamp: notificationInfo.timestamp,
          source: 'n8n_webhook'
        }
      }
    };
    
    console.log('✅ Procesamiento exitoso');
    console.log('📤 Resultado:', JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en procesamiento:', error.message);
    return {
      success: false,
      error: error.message,
      testCase: testCase.name
    };
  }
}

// Función para probar el endpoint con el resultado
async function testEndpoint(result, testCaseName) {
  if (!result.success) {
    console.log(`⏭️ Saltando prueba de endpoint para ${testCaseName} (procesamiento falló)`);
    return;
  }
  
  try {
    console.log(`\n📡 Probando endpoint con resultado de: ${testCaseName}`);
    
    const response = await fetch('http://localhost:3001/api/webhook/drive-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result.webAppData)
    });
    
    console.log('📡 Status de respuesta:', response.status);
    const responseData = await response.text();
    console.log('📄 Respuesta del servidor:', responseData.substring(0, 200) + (responseData.length > 200 ? '...' : ''));
    
    if (response.ok) {
      console.log('✅ Endpoint respondió correctamente');
    } else {
      console.log('❌ Error en endpoint');
    }
    
  } catch (error) {
    console.error('💥 Error de conexión con endpoint:', error.message);
  }
}

// Ejecutar todas las pruebas
async function runAllTests() {
  console.log('🚀 Iniciando simulación de webhook de Google Drive');
  console.log('=' .repeat(80));
  
  for (const testCase of testCases) {
    const result = simulateN8nCodeNode(testCase);
    await testEndpoint(result, testCase.name);
    console.log('\n' + '-'.repeat(80));
  }
  
  console.log('\n🏁 Todas las pruebas completadas');
  console.log('\n💡 RECOMENDACIONES:');
  console.log('1. Usa la versión de debug (n8n_debug_version.js) en tu Code Node');
  console.log('2. Revisa los logs de n8n para ver exactamente qué formato de datos está llegando');
  console.log('3. Si el formato es diferente, ajusta el código según los resultados');
}

// Ejecutar las pruebas
runAllTests();