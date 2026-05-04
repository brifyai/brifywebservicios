// Versión de debugging para n8n - Code Node
// Esta versión incluye logging extensivo para diagnosticar problemas

console.log('🚀 Iniciando procesamiento de webhook en n8n...');

try {
  // Paso 1: Obtener datos de entrada
  console.log('📥 Obteniendo datos de entrada...');
  const inputData = $input.all();
  console.log('📊 Input data completo:', JSON.stringify(inputData, null, 2));
  
  if (!inputData || inputData.length === 0) {
    console.error('❌ ERROR: No hay datos de entrada');
    return {
      json: {
        success: false,
        error: 'No input data received',
        timestamp: new Date().toISOString(),
        debug: 'inputData is empty or null'
      }
    };
  }
  
  // Paso 2: Extraer el primer elemento
  let webhookData = inputData[0].json;
  console.log('📋 Webhook data extraído:', JSON.stringify(webhookData, null, 2));
  
  if (!webhookData) {
    console.error('❌ ERROR: webhookData es null o undefined');
    return {
      json: {
        success: false,
        error: 'Webhook data is null',
        timestamp: new Date().toISOString(),
        debug: 'webhookData extracted from input is null'
      }
    };
  }
  
  // Paso 3: Verificar estructura de datos
  console.log('🔍 Verificando estructura de datos...');
  console.log('📝 Tipo de webhookData:', typeof webhookData);
  console.log('📝 Keys de webhookData:', Object.keys(webhookData));
  
  // Paso 4: Buscar headers en diferentes ubicaciones
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
    console.error('❌ ERROR: No se encontraron headers');
    return {
      json: {
        success: false,
        error: 'No headers found',
        timestamp: new Date().toISOString(),
        debug: {
          webhookDataKeys: Object.keys(webhookData),
          webhookDataSample: webhookData
        }
      }
    };
  }
  
  // Paso 5: Verificar si es notificación de Google Drive
  const channelId = headers['x-goog-channel-id'];
  console.log('🆔 Channel ID encontrado:', channelId);
  
  if (!channelId) {
    console.error('❌ ERROR: No es una notificación válida de Google Drive');
    return {
      json: {
        success: false,
        error: 'Not a valid Google Drive notification',
        timestamp: new Date().toISOString(),
        debug: {
          headers: headers,
          missingHeader: 'x-goog-channel-id'
        }
      }
    };
  }
  
  // Paso 6: Extraer información de la notificación
  console.log('⚙️ Procesando información de la notificación...');
  
  const notificationInfo = {
    channelId: headers['x-goog-channel-id'],
    channelExpiration: headers['x-goog-channel-expiration'],
    resourceState: headers['x-goog-resource-state'],
    changedType: headers['x-goog-changed'],
    messageNumber: headers['x-goog-message-number'],
    resourceId: headers['x-goog-resource-id'],
    resourceUri: headers['x-goog-resource-uri'],
    channelToken: headers['x-goog-channel-token'],
    timestamp: new Date().toISOString()
  };
  
  console.log('📊 Información de notificación:', JSON.stringify(notificationInfo, null, 2));
  
  // Paso 7: Determinar tipo de cambio
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
  
  console.log('🔄 Tipo de cambio determinado:', changeType);
  
  // Paso 8: Preparar datos para HTTP Request Node
  const webAppData = {
    headers: headers,
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
  
  console.log('📦 Datos preparados para HTTP Request Node:', JSON.stringify(webAppData, null, 2));
  
  // Paso 9: Preparar respuesta final
  const finalResult = {
    success: true,
    notificationInfo,
    changeType,
    timestamp: notificationInfo.timestamp,
    source: 'n8n_webhook',
    originalWebhookData: webhookData,
    webAppData: webAppData,
    readyForHttpRequest: true,
    processedAt: new Date().toISOString(),
    debug: {
      inputDataLength: inputData.length,
      webhookDataKeys: Object.keys(webhookData),
      headersFound: Object.keys(headers).length,
      channelIdFound: !!channelId
    }
  };
  
  console.log('✅ Procesamiento completado exitosamente');
  console.log('📤 Resultado final:', JSON.stringify(finalResult, null, 2));
  
  return {
    json: finalResult
  };
  
} catch (error) {
  console.error('💥 ERROR CRÍTICO en procesamiento:', error);
  console.error('📍 Stack trace:', error.stack);
  
  return {
    json: {
      success: false,
      error: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
      source: 'n8n_webhook',
      debug: 'Critical error in processing'
    }
  };
}

// Nota: Este código debe reemplazar temporalmente el contenido del Code Node
// para diagnosticar exactamente dónde está fallando el procesamiento