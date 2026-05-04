// Script para simular el escenario específico del nuevo usuario
const fetch = require('node-fetch');

// Simular diferentes escenarios que podrían ocurrir con un nuevo usuario
const newUserScenarios = [
  {
    name: 'Escenario 1: Webhook recibe llamada pero sin headers de Google Drive',
    data: {
      body: {
        timestamp: new Date().toISOString(),
        source: 'webhook_call'
      }
    }
  },
  {
    name: 'Escenario 2: Headers de Google Drive pero channel ID no existe en BD',
    data: {
      headers: {
        'x-goog-channel-id': 'nuevo-usuario-channel-inexistente',
        'x-goog-resource-state': 'update',
        'x-goog-changed': 'children',
        'x-goog-message-number': '1',
        'x-goog-resource-uri': 'https://www.googleapis.com/drive/v3/files/nuevo-archivo-id?alt=json'
      }
    }
  },
  {
    name: 'Escenario 3: Datos completamente vacíos (como reporta el usuario)',
    data: null
  },
  {
    name: 'Escenario 4: Objeto vacío',
    data: {}
  },
  {
    name: 'Escenario 5: Solo metadata de n8n sin datos de Google Drive',
    data: {
      meta: {
        instanceId: 'n8n-instance'
      },
      timestamp: new Date().toISOString()
    }
  },
  {
    name: 'Escenario 6: Headers malformados',
    data: {
      'x-goog-channel-id': '',
      'x-goog-resource-state': '',
      'x-goog-changed': ''
    }
  }
];

// Función que simula exactamente el código de n8n_debug_version.js
function simulateN8nDebugCode(scenario) {
  console.log(`\n🔍 SIMULANDO: ${scenario.name}`);
  console.log('=' .repeat(60));
  
  try {
    // Simular $input.all()
    const inputData = scenario.data ? [{ json: scenario.data }] : [];
    console.log('📥 $input.all() simulado:', JSON.stringify(inputData, null, 2));
    
    if (inputData.length === 0) {
      console.log('❌ No hay datos de entrada - $input.all() está vacío');
      return { error: 'No input data', isEmpty: true };
    }
    
    // Simular $input.all()[0].json
    const webhookData = inputData[0].json;
    console.log('📋 webhookData:', JSON.stringify(webhookData, null, 2));
    
    if (!webhookData) {
      console.log('❌ webhookData es null o undefined');
      return { error: 'webhookData is null', isEmpty: true };
    }
    
    if (typeof webhookData !== 'object') {
      console.log('❌ webhookData no es un objeto');
      return { error: 'webhookData is not object', isEmpty: true };
    }
    
    const keys = Object.keys(webhookData);
    console.log('🔑 Keys disponibles:', keys);
    
    if (keys.length === 0) {
      console.log('❌ webhookData está vacío');
      return { error: 'webhookData is empty object', isEmpty: true };
    }
    
    // Buscar headers
    let headers = null;
    
    // Opción 1: headers directos
    if (webhookData.headers) {
      headers = webhookData.headers;
      console.log('✅ Headers encontrados en webhookData.headers');
    }
    // Opción 2: headers en body
    else if (webhookData.body && webhookData.body.headers) {
      headers = webhookData.body.headers;
      console.log('✅ Headers encontrados en webhookData.body.headers');
    }
    // Opción 3: headers de Google Drive directamente en el objeto
    else {
      const googleHeaders = {};
      for (const key in webhookData) {
        if (key.startsWith('x-goog-')) {
          googleHeaders[key] = webhookData[key];
        }
      }
      
      if (Object.keys(googleHeaders).length > 0) {
        headers = googleHeaders;
        console.log('✅ Headers de Google Drive encontrados directamente');
      }
    }
    
    console.log('📋 Headers extraídos:', JSON.stringify(headers, null, 2));
    
    if (!headers) {
      console.log('❌ No se encontraron headers de Google Drive');
      return { error: 'No Google Drive headers found', isEmpty: true };
    }
    
    const channelId = headers['x-goog-channel-id'];
    console.log('🆔 Channel ID:', channelId);
    
    if (!channelId || channelId.trim() === '') {
      console.log('❌ Channel ID vacío o inválido');
      return { error: 'Invalid or empty channel ID', isEmpty: true };
    }
    
    // Si llegamos aquí, tenemos datos válidos
    const result = {
      success: true,
      channelId: channelId,
      resourceState: headers['x-goog-resource-state'],
      changed: headers['x-goog-changed'],
      messageNumber: headers['x-goog-message-number'],
      resourceUri: headers['x-goog-resource-uri']
    };
    
    console.log('✅ Procesamiento exitoso');
    console.log('📤 Resultado:', JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    console.error('💥 Error durante procesamiento:', error.message);
    console.error('📚 Stack trace:', error.stack);
    return { error: error.message, isEmpty: true };
  }
}

// Función para analizar por qué el output está vacío
function analyzeEmptyOutput(result, scenarioName) {
  console.log(`\n🔬 ANÁLISIS DE OUTPUT VACÍO - ${scenarioName}`);
  console.log('-' .repeat(60));
  
  if (result.isEmpty) {
    console.log('❌ CONFIRMADO: Este escenario produce output vacío');
    console.log('🔍 Razón:', result.error);
    
    // Sugerencias específicas
    if (result.error.includes('No input data')) {
      console.log('💡 SOLUCIÓN: Verificar que el webhook de n8n esté recibiendo datos');
      console.log('   - Revisar configuración del webhook trigger en n8n');
      console.log('   - Verificar que Google Drive esté enviando notificaciones');
    }
    else if (result.error.includes('webhookData is null')) {
      console.log('💡 SOLUCIÓN: El webhook recibe la llamada pero sin datos JSON');
      console.log('   - Verificar Content-Type en la configuración del webhook');
      console.log('   - Revisar si Google Drive está enviando body vacío');
    }
    else if (result.error.includes('empty object')) {
      console.log('💡 SOLUCIÓN: El webhook recibe un objeto vacío {}');
      console.log('   - Esto indica que Google Drive no está enviando headers');
      console.log('   - Verificar configuración del watch channel');
    }
    else if (result.error.includes('No Google Drive headers')) {
      console.log('💡 SOLUCIÓN: Los datos no contienen headers de Google Drive');
      console.log('   - Verificar que el webhook esté configurado para Google Drive');
      console.log('   - Revisar si hay un proxy o middleware modificando los headers');
    }
    else if (result.error.includes('Invalid or empty channel ID')) {
      console.log('💡 SOLUCIÓN: Channel ID vacío o inválido');
      console.log('   - Verificar que el watch channel esté activo en Google Drive');
      console.log('   - Revisar configuración del channel en la base de datos');
    }
  } else {
    console.log('✅ Este escenario NO produce output vacío');
    console.log('📊 Datos procesados correctamente');
  }
}

// Ejecutar todas las simulaciones
async function runNewUserDiagnostic() {
  console.log('🚨 DIAGNÓSTICO: Output vacío en Code Node para nuevo usuario');
  console.log('=' .repeat(80));
  
  let emptyOutputCount = 0;
  
  for (const scenario of newUserScenarios) {
    const result = simulateN8nDebugCode(scenario);
    analyzeEmptyOutput(result, scenario.name);
    
    if (result.isEmpty) {
      emptyOutputCount++;
    }
    
    console.log('\n' + '=' .repeat(80));
  }
  
  console.log('\n📊 RESUMEN DEL DIAGNÓSTICO:');
  console.log(`- Escenarios que producen output vacío: ${emptyOutputCount}/${newUserScenarios.length}`);
  console.log(`- Escenarios exitosos: ${newUserScenarios.length - emptyOutputCount}/${newUserScenarios.length}`);
  
  console.log('\n🎯 PASOS RECOMENDADOS PARA EL NUEVO USUARIO:');
  console.log('1. Reemplazar el Code Node actual con n8n_debug_version.js');
  console.log('2. Ejecutar una prueba y revisar los logs detallados');
  console.log('3. Verificar que el watch channel esté activo en la base de datos');
  console.log('4. Confirmar que Google Drive esté enviando notificaciones al webhook correcto');
  console.log('5. Revisar la configuración del webhook trigger en n8n');
}

// Ejecutar el diagnóstico
runNewUserDiagnostic();