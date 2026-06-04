// Script de diagnóstico corregido para verificar watch channels
// Ejecutar en la consola del navegador después de comprar un plan
// VERSIÓN CORREGIDA - Usa credenciales directas de Supabase

// Función para cargar Supabase desde CDN si no está disponible
const loadSupabaseLibrary = async () => {
  if (typeof window.supabase !== 'undefined') {
    return true;
  }
  
  console.log('📦 Cargando librería de Supabase desde CDN...');
  
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
      console.log('✅ Librería de Supabase cargada exitosamente');
      resolve(true);
    };
    script.onerror = () => {
      console.error('❌ Error cargando librería de Supabase');
      resolve(false);
    };
    document.head.appendChild(script);
  });
};

// Obtener la instancia de Supabase desde la aplicación React
const getSupabaseInstance = () => {
  // Intentar obtener desde el contexto global de React
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    const reactFiber = document.querySelector('#root')._reactInternalFiber ||
                      document.querySelector('#root')._reactInternals;
    if (reactFiber) {
      // Buscar en el árbol de componentes
      let current = reactFiber;
      while (current) {
        if (current.memoizedProps && current.memoizedProps.supabase) {
          return current.memoizedProps.supabase;
        }
        current = current.child || current.sibling || current.return;
      }
    }
  }
  
  // Fallback: crear una nueva instancia
  console.log('⚠️ Creando nueva instancia de Supabase...');
  const { createClient } = window.supabase || {};
  if (createClient) {
    return createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_ANON_KEY
    );
  }
  
  return null;
};

// Función para obtener Supabase de manera más directa
const getSupabase = async () => {
  // Intentar desde window primero
  if (window.supabaseClient) {
    return window.supabaseClient;
  }
  
  // Intentar desde módulos importados
  if (window.__SUPABASE_CLIENT__) {
    return window.__SUPABASE_CLIENT__;
  }
  
  // Cargar librería si no está disponible
  const libraryLoaded = await loadSupabaseLibrary();
  if (!libraryLoaded) {
    console.error('❌ No se pudo cargar la librería de Supabase');
    return null;
  }
  
  // Crear instancia directamente con credenciales hardcodeadas
  const supabaseUrl = 'https://leoyybfbnjajkktprhro.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb3l5YmZibmphamtrdHByaHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ0MTYsImV4cCI6MjA2NDM5MDQxNn0.VfJoDIHgXB1k4kwgndmr2yLNDeDBBIrOVsbqaSWrjHU';
  
  console.log('🔧 Creando instancia de Supabase con credenciales directas...');
  
  // Verificar si tenemos acceso a la librería de Supabase
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    const client = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log('✅ Cliente de Supabase creado exitosamente');
    return client;
  }
  
  // Fallback: intentar con createClient global
  if (typeof window.createClient !== 'undefined') {
    const client = window.createClient(supabaseUrl, supabaseKey);
    console.log('✅ Cliente de Supabase creado exitosamente (fallback)');
    return client;
  }
  
  console.error('❌ No se pudo crear el cliente de Supabase');
  return null;
};

// 1. Verificar si hay watch channels en la base de datos
async function checkWatchChannels() {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      console.error('❌ No se pudo obtener la instancia de Supabase');
      console.log('💡 Solución: Asegúrate de estar en la página de la aplicación y que esté cargada');
      return;
    }
    
    const { data, error } = await supabase
      .from('drive_watch_channels')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (error) {
      console.error('❌ Error consultando watch channels:', error)
      return
    }
    
    console.log('📊 Watch channels encontrados:', data)
    
    if (data && data.length > 0) {
      const latestChannel = data[0]
      console.log('🔍 Último watch channel creado:', {
        id: latestChannel.id,
        channel_id: latestChannel.channel_id,
        folder_id: latestChannel.folder_id,
        user_id: latestChannel.user_id,
        is_active: latestChannel.is_active,
        webhook_url: latestChannel.webhook_url,
        expiration: latestChannel.expiration,
        created_at: latestChannel.created_at
      })
      
      // Verificar si el canal está activo y no ha expirado
      const now = new Date()
      const expiration = latestChannel.expiration ? new Date(latestChannel.expiration) : null
      
      if (!latestChannel.is_active) {
        console.warn('⚠️ El watch channel está marcado como inactivo')
      }
      
      if (expiration && expiration < now) {
        console.warn('⚠️ El watch channel ha expirado:', expiration)
        console.log('💡 Solución: Renovar el watch channel')
      }
      
      if (latestChannel.is_active && (!expiration || expiration > now)) {
        console.log('✅ El watch channel está activo y válido')
        
        // Verificar si la URL del webhook es correcta
        const expectedWebhookUrl = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
        if (latestChannel.webhook_url !== expectedWebhookUrl) {
          console.warn('⚠️ URL del webhook no coincide:', {
            actual: latestChannel.webhook_url,
            expected: expectedWebhookUrl
          })
        } else {
          console.log('✅ URL del webhook es correcta')
        }
      }
    } else {
      console.warn('⚠️ No se encontraron watch channels')
      console.log('💡 Solución: Comprar un plan para crear un watch channel')
    }
  } catch (error) {
    console.error('❌ Error en checkWatchChannels:', error)
  }
}

// 2. Verificar credenciales de Google Drive
async function checkGoogleCredentials() {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      console.error('❌ No se pudo obtener la instancia de Supabase');
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ Usuario no autenticado')
      return
    }
    
    const { data, error } = await supabase
      .from('user_credentials')
      .select('google_access_token, google_refresh_token')
      .eq('user_id', user.id)
      .single()
    
    if (error) {
      console.error('❌ Error consultando credenciales:', error)
      console.log('💡 Solución: Reconectar cuenta de Google Drive')
      return
    }
    
    if (data) {
      console.log('🔑 Credenciales de Google encontradas:', {
        has_access_token: !!data.google_access_token,
        has_refresh_token: !!data.google_refresh_token
      })
      
      // Probar el token haciendo una llamada a la API
      if (data.google_access_token) {
        await testGoogleApiAccess(data.google_access_token)
      }
    } else {
      console.warn('⚠️ No se encontraron credenciales de Google')
      console.log('💡 Solución: Conectar cuenta de Google Drive en configuración')
    }
  } catch (error) {
    console.error('❌ Error en checkGoogleCredentials:', error)
  }
}

// 3. Probar acceso a Google Drive API
async function testGoogleApiAccess(accessToken) {
  try {
    console.log('🧪 Probando acceso a Google Drive API...')
    
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Acceso a Google Drive API exitoso:', data.user.emailAddress)
    } else {
      const error = await response.text()
      console.error('❌ Error en Google Drive API:', response.status, error)
      
      if (response.status === 401) {
        console.log('💡 Solución: Token expirado, necesita renovación')
      } else if (response.status === 403) {
        console.log('💡 Solución: Permisos insuficientes, verificar scopes')
      }
    }
  } catch (error) {
    console.error('❌ Error probando Google Drive API:', error)
  }
}

// 4. Verificar webhook URL accesibilidad
async function testWebhookUrl() {
  try {
    console.log('🧪 Probando accesibilidad del webhook...')
    
    const webhookUrl = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
    
    // Hacer una petición GET para verificar que el endpoint responde
    const response = await fetch(webhookUrl, {
      method: 'GET',
      mode: 'no-cors' // Para evitar problemas de CORS
    })
    
    console.log('📡 Webhook URL responde (status no disponible por CORS)')
    console.log('✅ El webhook parece estar accesible')
    
  } catch (error) {
    console.error('❌ Error probando webhook URL:', error)
    console.log('💡 Solución: Verificar que n8n esté funcionando y la URL sea correcta')
  }
}

// 5. Verificar configuración de carpeta administrador
async function checkAdminFolder() {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      console.error('❌ No se pudo obtener la instancia de Supabase');
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ Usuario no autenticado')
      return
    }
    
    const { data, error } = await supabase
      .from('carpeta_administrador')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (error) {
      console.error('❌ Error consultando carpeta administrador:', error)
      console.log('💡 Solución: Comprar un plan para crear carpeta administrador')
      return
    }
    
    if (data) {
      console.log('📁 Carpeta administrador encontrada:', {
        id: data.id,
        id_drive_carpeta: data.id_drive_carpeta,
        correo: data.correo,
        plan_name: data.plan_name,
        created_at: data.created_at
      })
      
      // Verificar que el folder_id coincida con el watch channel
      const { data: watchChannels } = await supabase
        .from('drive_watch_channels')
        .select('folder_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
      
      if (watchChannels && watchChannels.length > 0) {
        const matchingChannel = watchChannels.find(ch => ch.folder_id === data.id_drive_carpeta)
        if (matchingChannel) {
          console.log('✅ Watch channel configurado para la carpeta administrador')
        } else {
          console.warn('⚠️ No hay watch channel para la carpeta administrador')
          console.log('💡 Solución: Recrear watch channel para la carpeta')
        }
      }
    } else {
      console.warn('⚠️ No se encontró carpeta administrador')
    }
  } catch (error) {
    console.error('❌ Error en checkAdminFolder:', error)
  }
}

// 6. Verificar notificaciones recientes
async function checkRecentNotifications() {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      console.error('❌ No se pudo obtener la instancia de Supabase');
      return;
    }
    
    const { data, error } = await supabase
      .from('drive_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('❌ Error consultando notificaciones:', error)
      return
    }
    
    console.log('📬 Notificaciones recientes:', data)
    
    if (data && data.length > 0) {
      console.log('✅ Se encontraron', data.length, 'notificaciones')
      
      const pendingCount = data.filter(n => !n.processed).length
      console.log('📋 Notificaciones pendientes:', pendingCount)
      
      // Mostrar tipos de eventos recibidos
      const eventTypes = [...new Set(data.map(n => n.resource_state))]
      console.log('📊 Tipos de eventos recibidos:', eventTypes)
    } else {
      console.warn('⚠️ No se encontraron notificaciones')
      console.log('💡 Esto indica que Google Drive no está enviando notificaciones')
    }
  } catch (error) {
    console.error('❌ Error en checkRecentNotifications:', error)
  }
}

// 7. Probar la creación manual de un watch channel
async function testWatchChannelCreation() {
  try {
    console.log('🧪 Probando creación manual de watch channel...')
    
    const supabase = await getSupabase();
    if (!supabase) {
      console.error('❌ No se pudo obtener la instancia de Supabase');
      return;
    }
    
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ Usuario no autenticado')
      return
    }
    
    // Obtener credenciales
    const { data: credentials } = await supabase
      .from('user_credentials')
      .select('google_access_token')
      .eq('user_id', user.id)
      .single()
    
    if (!credentials || !credentials.google_access_token) {
      console.error('❌ No hay credenciales de Google disponibles')
      return
    }
    
    // Obtener carpeta de administrador
    const { data: adminFolder } = await supabase
      .from('carpeta_administrador')
      .select('id_drive_carpeta')
      .eq('user_id', user.id)
      .single()
    
    if (!adminFolder || !adminFolder.id_drive_carpeta) {
      console.error('❌ No se encontró carpeta de administrador')
      return
    }
    
    console.log('📋 Datos para crear watch channel:', {
      userId: user.id,
      folderId: adminFolder.id_drive_carpeta,
      hasAccessToken: !!credentials.google_access_token
    })
    
    // Probar llamada directa a Google Drive API
    const channelId = 'test-' + Date.now()
    const webhookUrl = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
    
    console.log('📡 Enviando petición a Google Drive API...')
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${adminFolder.id_drive_carpeta}/watch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.google_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: user.id
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Watch channel creado exitosamente en Google Drive:', data)
      
      // Cancelar inmediatamente para no interferir
      await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.google_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: channelId,
          resourceId: data.resourceId
        })
      })
      
      console.log('🧹 Watch channel de prueba cancelado')
    } else {
      const error = await response.text()
      console.error('❌ Error creando watch channel en Google Drive:', response.status, error)
      
      if (response.status === 401) {
        console.log('💡 Solución: Token expirado o inválido')
      } else if (response.status === 403) {
        console.log('💡 Solución: Permisos insuficientes o dominio no verificado')
      } else if (response.status === 400) {
        console.log('💡 Solución: Parámetros incorrectos en la petición')
      }
    }
  } catch (error) {
    console.error('❌ Error en testWatchChannelCreation:', error)
  }
}

// Función principal de diagnóstico
async function runDiagnostics() {
  console.log('🔍 Iniciando diagnóstico completo de watch channels...')
  console.log('=' + '='.repeat(50))
  
  // Inicializar Supabase una vez al principio
  console.log('\n🔧 Inicializando conexión a Supabase...')
  const supabase = await getSupabase();
  if (!supabase) {
    console.error('❌ No se pudo conectar a Supabase. Diagnóstico cancelado.');
    return;
  }
  
  console.log('\n1️⃣ Verificando watch channels en base de datos...')
  await checkWatchChannels()
  
  console.log('\n2️⃣ Verificando credenciales de Google...')
  await checkGoogleCredentials()
  
  console.log('\n3️⃣ Verificando carpeta administrador...')
  await checkAdminFolder()
  
  console.log('\n4️⃣ Probando accesibilidad del webhook...')
  await testWebhookUrl()
  
  console.log('\n5️⃣ Verificando notificaciones recientes...')
  await checkRecentNotifications()
  
  console.log('\n🔍 Diagnóstico completado')
  console.log('=' + '='.repeat(50))
  console.log('\n🧪 Para probar la creación manual de un watch channel:')
  console.log('   testWatchChannelCreation()')
  console.log('\n📚 Problemas comunes y soluciones:')
  console.log('   • Domain verification: Verificar en Google Search Console')
  console.log('   • Permisos: Verificar scopes de Google Drive API')
  console.log('   • Webhook: Verificar que n8n esté funcionando')
  console.log('   • Token: Renovar credenciales de Google Drive')
}

// Función para configurar Supabase manualmente
function setupSupabase(url, anonKey) {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', anonKey);
  console.log('✅ Configuración de Supabase guardada');
  console.log('🔄 Recarga la página y ejecuta el diagnóstico nuevamente');
}

// Exportar funciones para uso en consola
window.runDiagnostics = runDiagnostics
window.checkWatchChannels = checkWatchChannels
window.checkGoogleCredentials = checkGoogleCredentials
window.testWatchChannelCreation = testWatchChannelCreation
window.checkRecentNotifications = checkRecentNotifications
window.checkAdminFolder = checkAdminFolder
window.testWebhookUrl = testWebhookUrl
window.setupSupabase = setupSupabase

console.log('📋 Script de diagnóstico CORREGIDO cargado con credenciales directas.')
console.log('✅ Supabase configurado automáticamente - no necesitas configuración adicional')
console.log('🚀 Ejecuta runDiagnostics() para comenzar el diagnóstico completo.')
console.log('🧪 O ejecuta testWatchChannelCreation() para probar creación de watch channels')
console.log('📊 Funciones disponibles: checkWatchChannels, checkGoogleCredentials, checkAdminFolder, etc.')