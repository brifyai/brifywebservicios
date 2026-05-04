// Script para probar el endpoint con la notificación real recibida por el usuario

// Datos reales de la notificación recibida por el usuario
const realNotificationData = {
  headers: {
    "x-real-ip": "66.102.6.76",
    "x-forwarded-for": "66.102.6.76",
    "x-forwarded-proto": "https",
    "connection": "upgrade",
    "content-length": "0",
    "accept": "*/*",
    "x-goog-channel-id": "96536a5c-1824-4452-a732-c0bb4e5cd08b",
    "x-goog-channel-expiration": "Tue, 02 Sep 2025 02:54:23 GMT",
    "x-goog-resource-state": "update",
    "x-goog-changed": "children",
    "x-goog-message-number": "1449596",
    "x-goog-resource-id": "mqWFmR5RrOzuxUts4pyf9x3Sdec",
    "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/1zXaSqUi0jltR0QSJ9LViiQCaTMhgqabp?alt=json&null",
    "x-goog-channel-token": "956116e8-97a6-4d74-af2b-e834fac27ad4",
    "user-agent": "APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html)",
    "accept-encoding": "gzip, deflate, br"
  },
  body: {},
  processedData: {
    success: true,
    changeType: "file_added_or_removed",
    timestamp: new Date().toISOString(),
    source: "n8n_webhook",
    fileId: "1zXaSqUi0jltR0QSJ9LViiQCaTMhgqabp" // Extraído de la URI
  },
  timestamp: new Date().toISOString()
};

/**
 * Función para probar el endpoint con datos reales
 */
async function testRealNotification() {
  console.log('🧪 Probando endpoint con notificación REAL de Google Drive...');
  console.log('📤 Datos de la notificación real:', JSON.stringify(realNotificationData, null, 2));
  
  try {
    const response = await fetch('http://localhost:3001/api/webhook/drive-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(realNotificationData)
    });
    
    console.log('📊 Respuesta del servidor:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Respuesta exitosa:', JSON.stringify(result, null, 2));
      
      // Mostrar información extraída
      if (result.data) {
        console.log('\n📋 Información extraída:');
        console.log(`🆔 ID del archivo: ${result.data.fileId}`);
        console.log(`📁 Nombre del archivo: ${result.data.fileName}`);
        console.log(`🔄 Tipo de cambio: ${result.data.changeType}`);
        console.log(`📊 Estado del recurso: ${result.data.resourceState}`);
        console.log(`🔧 Cambios: ${result.data.changed}`);
      }
      
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
 * Función para verificar el estado del servidor
 */
async function checkServerStatus() {
  console.log('🔍 Verificando estado del servidor Express...');
  
  try {
    const response = await fetch('http://localhost:3001/api/test', {
      method: 'GET'
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Servidor Express funcionando:', result);
      return true;
    } else {
      console.error('❌ Servidor Express con problemas:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Servidor Express no disponible:', error.message);
    console.log('💡 Asegúrate de ejecutar: npm run server');
    return false;
  }
}

/**
 * Función para verificar si el watch channel existe en la base de datos
 */
async function checkWatchChannelExists() {
  console.log('\n🔍 Verificando si el watch channel existe en la base de datos...');
  console.log('📋 INSTRUCCIONES:');
  console.log('1. Ve a tu dashboard de Supabase');
  console.log('2. Abre el editor SQL');
  console.log('3. Ejecuta esta consulta:');
  console.log('');
  console.log('SELECT * FROM drive_watch_channels WHERE channel_id = \'96536a5c-1824-4452-a732-c0bb4e5cd08b\';');
  console.log('');
  console.log('4. Si no hay resultados, el watch channel no existe y necesitas:');
  console.log('   - Comprar un plan para crear el watch channel');
  console.log('   - O crear un watch channel manualmente para pruebas');
  console.log('');
  console.log('5. Si existe pero is_active = false, actívalo con:');
  console.log('UPDATE drive_watch_channels SET is_active = true WHERE channel_id = \'96536a5c-1824-4452-a732-c0bb4e5cd08b\';');
}

/**
 * Función principal
 */
async function runTest() {
  console.log('🚀 Iniciando prueba con notificación real de Google Drive\n');
  
  // Verificar servidor
  const serverOk = await checkServerStatus();
  if (!serverOk) {
    return;
  }
  
  // Probar con datos reales
  console.log('\n📨 Probando con notificación real...');
  const result = await testRealNotification();
  
  // Si hay error de watch channel, mostrar instrucciones
  if (!result.success && result.error.includes('Watch channel')) {
    await checkWatchChannelExists();
  }
  
  console.log('\n🎯 Prueba completada');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runTest();
}

// Exportar funciones para uso en navegador
if (typeof window !== 'undefined') {
  window.testRealNotification = testRealNotification;
  window.checkServerStatus = checkServerStatus;
  window.runTest = runTest;
}

module.exports = {
  testRealNotification,
  checkServerStatus,
  runTest,
  realNotificationData
};