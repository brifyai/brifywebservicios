// Script para probar el endpoint API de notificaciones de Google Drive
// Este script simula lo que n8n enviaría a nuestra aplicación

/**
 * Prueba el endpoint API con datos simulados de Google Drive
 */
async function testDriveNotificationsEndpoint() {
  console.log('🧪 Iniciando prueba del endpoint API de notificaciones...');
  
  // Datos simulados que n8n enviaría (basados en logs reales)
  const testData = {
    headers: {
      'x-goog-channel-id': 'test-channel-123',
      'x-goog-channel-expiration': 'Wed, 19 Nov 2025 05:00:00 GMT',
      'x-goog-resource-state': 'update',
      'x-goog-changed': 'children',
      'x-goog-message-number': '1',
      'x-goog-resource-id': 'test-resource-id',
      'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/test-folder-id?alt=json',
      'x-goog-channel-token': 'test-token'
    },
    body: {},
    processedData: {
      success: true,
      changeType: 'file_added_or_removed',
      timestamp: new Date().toISOString(),
      source: 'n8n_webhook'
    },
    timestamp: new Date().toISOString()
  };
  
  try {
    console.log('📤 Enviando datos de prueba:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://localhost:3001/api/webhook/drive-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📊 Respuesta del servidor:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Respuesta exitosa:', JSON.stringify(result, null, 2));
      return result;
    } else {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      return { success: false, error: errorText };
    }
    
  } catch (error) {
    console.error('💥 Error de conexión:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Prueba con diferentes tipos de notificaciones
 */
async function testDifferentNotificationTypes() {
  console.log('\n🔄 Probando diferentes tipos de notificaciones...');
  
  const testCases = [
    {
      name: 'Archivo agregado',
      headers: {
        'x-goog-channel-id': 'test-channel-file-added',
        'x-goog-resource-state': 'update',
        'x-goog-changed': 'children',
        'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/folder123?alt=json'
      }
    },
    {
      name: 'Archivo modificado',
      headers: {
        'x-goog-channel-id': 'test-channel-file-modified',
        'x-goog-resource-state': 'update',
        'x-goog-changed': 'properties',
        'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/file456?alt=json'
      }
    },
    {
      name: 'Archivo eliminado',
      headers: {
        'x-goog-channel-id': 'test-channel-file-deleted',
        'x-goog-resource-state': 'trash',
        'x-goog-changed': 'children',
        'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/file789?alt=json'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Probando: ${testCase.name}`);
    
    const testData = {
      headers: {
        ...testCase.headers,
        'x-goog-channel-expiration': 'Wed, 19 Nov 2025 05:00:00 GMT',
        'x-goog-message-number': Math.floor(Math.random() * 1000).toString(),
        'x-goog-resource-id': `test-resource-${Date.now()}`,
        'x-goog-channel-token': 'test-token'
      },
      body: {},
      timestamp: new Date().toISOString()
    };
    
    const result = await testDriveNotificationsEndpoint();
    console.log(`${result.success ? '✅' : '❌'} ${testCase.name}: ${result.success ? 'OK' : result.error}`);
    
    // Esperar un poco entre pruebas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Verifica que el servidor esté ejecutándose
 */
async function checkServerStatus() {
  console.log('🔍 Verificando estado del servidor...');
  
  try {
    const response = await fetch('http://localhost:3001/api/test', {
      method: 'GET'
    });
    
    console.log(`📡 Servidor: ${response.ok ? '✅ Activo' : '❌ Error'} (${response.status})`);
    return response.ok;
  } catch (error) {
    console.error('❌ Servidor no disponible:', error.message);
    return false;
  }
}

/**
 * Función principal para ejecutar todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 Iniciando suite de pruebas del endpoint API\n');
  
  // Verificar servidor
  const serverOk = await checkServerStatus();
  if (!serverOk) {
    console.error('❌ No se puede continuar: servidor no disponible');
    console.log('💡 Asegúrate de que el servidor Express esté ejecutándose en http://localhost:3001');
    return;
  }
  
  // Prueba básica
  console.log('\n📋 Prueba básica:');
  await testDriveNotificationsEndpoint();
  
  // Pruebas de diferentes tipos
  await testDifferentNotificationTypes();
  
  console.log('\n🎯 Suite de pruebas completada');
}

// Ejecutar si se llama directamente
if (typeof window !== 'undefined') {
  // En el navegador
  console.log('🌐 Ejecutando en el navegador');
  console.log('💡 Usa: runAllTests() para ejecutar todas las pruebas');
  console.log('💡 Usa: testDriveNotificationsEndpoint() para una prueba básica');
  
  // Hacer funciones disponibles globalmente
  window.runAllTests = runAllTests;
  window.testDriveNotificationsEndpoint = testDriveNotificationsEndpoint;
  window.testDifferentNotificationTypes = testDifferentNotificationTypes;
  window.checkServerStatus = checkServerStatus;
} else {
  // En Node.js
  console.log('🖥️ Ejecutando en Node.js');
  runAllTests().catch(console.error);
}

// Exportar funciones para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testDriveNotificationsEndpoint,
    testDifferentNotificationTypes,
    checkServerStatus
  };
}