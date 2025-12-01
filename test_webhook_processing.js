// Script de prueba para el procesamiento de webhooks de Google Drive
// Ejecutar en la consola del navegador después de cargar la aplicación

// Función para probar el procesamiento de webhooks
async function testWebhookProcessing() {
  console.log('🧪 Iniciando prueba de procesamiento de webhooks...');
  
  // Datos reales de tu log - Creación de carpeta
  const folderCreationData = {
    headers: {
      "host": "n8n-service-aintelligence.captain.maquinaintelligence.xyz",
      "x-real-ip": "66.102.6.77",
      "x-forwarded-for": "66.102.6.77",
      "x-forwarded-proto": "https",
      "connection": "upgrade",
      "content-length": "0",
      "accept": "*/*",
      "x-goog-channel-id": "6e32b6bc-2f15-471d-9e25-8c74cb17af36",
      "x-goog-channel-expiration": "Tue, 02 Sep 2025 02:01:01 GMT",
      "x-goog-resource-state": "update",
      "x-goog-changed": "children",
      "x-goog-message-number": "2520439",
      "x-goog-resource-id": "-WTRHa6IbO2ykuu1lCM-PH6gXSU",
      "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/1_-oCgWAyfD_3q-1fN5CUrP8Z_qknRhqz?alt=json&null",
      "x-goog-channel-token": "f912b488-ca28-4d9b-a70c-b59c083fc943",
      "user-agent": "APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html)",
      "accept-encoding": "gzip, deflate, br"
    },
    params: {},
    query: {},
    body: {},
    webhookUrl: "https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135",
    executionMode: "production"
  };
  
  // Datos reales de tu log - Subida de archivo (mismo formato)
  const fileUploadData = {
    ...folderCreationData,
    headers: {
      ...folderCreationData.headers,
      "x-goog-message-number": "2520440" // Número diferente para simular evento posterior
    }
  };
  
  try {
    // Verificar que tenemos acceso a las clases necesarias
    if (typeof window.WebhookHandler === 'undefined') {
      console.error('❌ WebhookHandler no está disponible. Asegúrate de haber cargado el script.');
      return;
    }
    
    console.log('\n📁 Probando procesamiento de creación de carpeta...');
    const folderResult = await window.WebhookHandler.handleDriveNotification(folderCreationData);
    console.log('📊 Resultado carpeta:', folderResult);
    
    console.log('\n📄 Probando procesamiento de subida de archivo...');
    const fileResult = await window.WebhookHandler.handleDriveNotification(fileUploadData);
    console.log('📊 Resultado archivo:', fileResult);
    
    // Resumen
    console.log('\n📋 RESUMEN DE PRUEBAS:');
    console.log('='.repeat(50));
    console.log('Carpeta - Éxito:', folderResult.success);
    console.log('Carpeta - Tipo:', folderResult.data?.changeType || 'N/A');
    console.log('Archivo - Éxito:', fileResult.success);
    console.log('Archivo - Tipo:', fileResult.data?.changeType || 'N/A');
    
    return {
      folderTest: folderResult,
      fileTest: fileResult
    };
    
  } catch (error) {
    console.error('💥 Error en las pruebas:', error);
    return { error: error.message };
  }
}

// Función para verificar el estado de los watch channels
async function checkWatchChannelStatus() {
  console.log('🔍 Verificando estado de watch channels...');
  
  try {
    // Verificar que tenemos acceso a Supabase
    const supabase = window.supabase || window.__SUPABASE__ || window.supabaseClient;
    if (!supabase) {
      console.error('❌ Supabase no está disponible');
      return;
    }
    
    // Obtener watch channels activos
    const { data: channels, error } = await supabase
      .from('drive_watch_channels')
      .select(`
        id,
        channel_id,
        user_id,
        resource_id,
        expiration_time,
        is_active,
        created_at
      `)
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Error obteniendo watch channels:', error);
      return;
    }
    
    console.log('📡 Watch channels activos:', channels);
    
    // Verificar si tenemos el canal de las notificaciones
    const targetChannelId = '6e32b6bc-2f15-471d-9e25-8c74cb17af36';
    const targetChannel = channels.find(ch => ch.channel_id === targetChannelId);
    
    if (targetChannel) {
      console.log('✅ Canal objetivo encontrado:', targetChannel);
      
      // Verificar expiración
      const expirationDate = new Date(targetChannel.expiration_time);
      const now = new Date();
      const isExpired = expirationDate < now;
      
      console.log('📅 Expiración:', expirationDate.toLocaleString());
      console.log('⏰ Estado:', isExpired ? '❌ EXPIRADO' : '✅ ACTIVO');
      
      if (isExpired) {
        console.warn('⚠️ El watch channel ha expirado. Necesita renovarse.');
      }
    } else {
      console.warn('⚠️ Canal objetivo no encontrado en la base de datos');
    }
    
    return channels;
    
  } catch (error) {
    console.error('💥 Error verificando watch channels:', error);
    return null;
  }
}

// Función para verificar notificaciones recientes
async function checkRecentNotifications() {
  console.log('📨 Verificando notificaciones recientes...');
  
  try {
    const supabase = window.supabase || window.__SUPABASE__ || window.supabaseClient;
    if (!supabase) {
      console.error('❌ Supabase no está disponible');
      return;
    }
    
    // Obtener notificaciones de las últimas 24 horas
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: notifications, error } = await supabase
      .from('drive_notifications')
      .select(`
        id,
        channel_id,
        resource_state,
        changed_files,
        notification_data,
        processed_at,
        created_at
      `)
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error obteniendo notificaciones:', error);
      return;
    }
    
    console.log('📋 Notificaciones recientes:', notifications);
    
    if (notifications.length === 0) {
      console.log('ℹ️ No hay notificaciones recientes en la base de datos');
    } else {
      console.log(`📊 Total de notificaciones en 24h: ${notifications.length}`);
      
      // Agrupar por tipo
      const byType = notifications.reduce((acc, notif) => {
        const type = notif.notification_data?.changeType || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📈 Distribución por tipo:', byType);
    }
    
    return notifications;
    
  } catch (error) {
    console.error('💥 Error verificando notificaciones:', error);
    return null;
  }
}

// Función principal para ejecutar todas las pruebas
async function runFullDiagnostic() {
  console.log('🚀 Ejecutando diagnóstico completo del sistema de webhooks...');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar watch channels
    console.log('\n1️⃣ VERIFICANDO WATCH CHANNELS');
    const channels = await checkWatchChannelStatus();
    
    // 2. Verificar notificaciones recientes
    console.log('\n2️⃣ VERIFICANDO NOTIFICACIONES RECIENTES');
    const notifications = await checkRecentNotifications();
    
    // 3. Probar procesamiento de webhooks
    console.log('\n3️⃣ PROBANDO PROCESAMIENTO DE WEBHOOKS');
    const testResults = await testWebhookProcessing();
    
    // 4. Resumen final
    console.log('\n📋 RESUMEN FINAL');
    console.log('='.repeat(60));
    console.log('Watch channels activos:', channels?.length || 0);
    console.log('Notificaciones 24h:', notifications?.length || 0);
    console.log('Prueba de procesamiento:', testResults?.folderTest?.success ? '✅' : '❌');
    
    return {
      channels,
      notifications,
      testResults
    };
    
  } catch (error) {
    console.error('💥 Error en diagnóstico completo:', error);
    return { error: error.message };
  }
}

// Instrucciones de uso
console.log(`
🔧 INSTRUCCIONES DE USO:

1. Ejecutar diagnóstico completo:
   await runFullDiagnostic()

2. Solo probar procesamiento:
   await testWebhookProcessing()

3. Solo verificar watch channels:
   await checkWatchChannelStatus()

4. Solo verificar notificaciones:
   await checkRecentNotifications()

📝 Nota: Asegúrate de estar en una página donde Supabase esté disponible.
`);

// Exportar funciones para uso global
if (typeof window !== 'undefined') {
  window.testWebhookProcessing = testWebhookProcessing;
  window.checkWatchChannelStatus = checkWatchChannelStatus;
  window.checkRecentNotifications = checkRecentNotifications;
  window.runFullDiagnostic = runFullDiagnostic;
}