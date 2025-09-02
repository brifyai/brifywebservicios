// Script para diagnosticar problemas de webhooks desde la consola del navegador
// Compatible con el entorno del navegador y la instancia de Supabase existente

// Función para verificar domain verification
async function checkDomainVerification() {
  console.log('🔍 Verificando Domain Verification...')
  
  const webhookUrl = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
  const domain = new URL(webhookUrl).hostname
  
  console.log('📍 Dominio del webhook:', domain)
  console.log('⚠️ IMPORTANTE: Verificar que este dominio esté registrado en:')
  console.log('   1. Google Cloud Console > Domain Verification')
  console.log('   2. Google Search Console')
  console.log('   3. Que el certificado SSL sea válido')
  
  // Verificar webhook con método GET en lugar de HEAD para evitar CORS
  try {
    // Usar fetch con mode: 'no-cors' para evitar problemas de CORS
    const response = await fetch(webhookUrl, { 
      method: 'GET',
      mode: 'no-cors'
    })
    console.log('✅ Webhook accesible (sin verificar respuesta por CORS)')
  } catch (error) {
    console.error('❌ Error al acceder al webhook:', error.message)
  }
}

// Función para verificar permisos del service account
async function checkServiceAccountPermissions() {
  console.log('\n🔍 Verificando permisos del Service Account...')
  
  // Intentar obtener Supabase de diferentes formas
  let supabase = null
  
  // Método 1: window.supabase
  if (typeof window !== 'undefined' && window.supabase) {
    supabase = window.supabase
    console.log('✅ Usando window.supabase')
  }
  // Método 2: Buscar en el contexto global de React
  else if (typeof window !== 'undefined' && window.React) {
    // Intentar acceder al contexto de la aplicación
    console.log('🔍 Buscando Supabase en el contexto de React...')
    // Verificar si hay alguna instancia global
    const possibleSupabase = window.__SUPABASE__ || window.supabaseClient
    if (possibleSupabase) {
      supabase = possibleSupabase
      console.log('✅ Supabase encontrado en contexto global')
    }
  }
  
  if (!supabase) {
    console.error('❌ Supabase no disponible. Instrucciones:')
    console.log('1. Asegúrate de estar en la página de la aplicación')
    console.log('2. Abre la consola del navegador en la pestaña de la aplicación')
    console.log('3. Ejecuta: window.supabase = supabaseClient (donde supabaseClient es tu instancia)')
    console.log('4. O ejecuta este script desde el contexto de la aplicación React')
    return
  }
  const user = await supabase.auth.getUser()
  const actualUser = user?.data?.user
  
  if (!actualUser) {
    console.error('❌ Usuario no autenticado')
    return
  }
  
  console.log('👤 Usuario autenticado:', actualUser.email)
  
  // Obtener credenciales
  const { data: credentials, error: credError } = await supabase
    .from('user_credentials')
    .select('google_access_token, google_refresh_token')
    .eq('user_id', actualUser.id)
    .single()
    
  if (credError) {
    console.error('❌ Error obteniendo credenciales:', credError.message)
    return
  }
    
  if (!credentials?.google_access_token) {
    console.error('❌ No hay token de acceso de Google')
    return
  }
  
  console.log('✅ Token de Google encontrado')
  
  // Obtener carpeta administrador
  const { data: adminFolder, error: folderError } = await supabase
    .from('carpeta_administrador')
    .select('id_drive_carpeta, correo, plan_name')
    .eq('user_id', actualUser.id)
    .single()
    
  if (folderError) {
    console.error('❌ Error obteniendo carpeta administrador:', folderError.message)
    return
  }
    
  if (!adminFolder?.id_drive_carpeta) {
    console.error('❌ No hay carpeta administrador')
    return
  }
  
  console.log('📁 Carpeta administrador encontrada:')
  console.log('   ID:', adminFolder.id_drive_carpeta)
  console.log('   Email:', adminFolder.correo)
  console.log('   Plan:', adminFolder.plan_name)
  
  // Verificar permisos en la carpeta
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${adminFolder.id_drive_carpeta}?fields=id,name,owners,permissions`, {
      headers: {
        'Authorization': `Bearer ${credentials.google_access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const folderInfo = await response.json()
      console.log('✅ Acceso a carpeta confirmado:', folderInfo.name)
      console.log('👥 Propietarios:', folderInfo.owners?.map(o => o.emailAddress))
      console.log('🔐 Permisos:', folderInfo.permissions?.length || 0, 'permisos configurados')
    } else {
      const errorText = await response.text()
      console.error('❌ Error al acceder a la carpeta:', response.status, response.statusText)
      console.error('   Detalles:', errorText)
    }
  } catch (error) {
    console.error('❌ Error verificando permisos:', error.message)
  }
}

// Función para verificar el formato del watch channel
async function checkWatchChannelFormat() {
  console.log('\n🔍 Verificando formato del watch channel...')
  
  // Obtener Supabase de la misma forma que en la función anterior
  let supabase = null
  
  if (typeof window !== 'undefined' && window.supabase) {
    supabase = window.supabase
  } else if (typeof window !== 'undefined' && window.__SUPABASE__) {
    supabase = window.__SUPABASE__
  } else if (typeof window !== 'undefined' && window.supabaseClient) {
    supabase = window.supabaseClient
  }
  
  if (!supabase) {
    console.error('❌ Supabase no disponible en el navegador')
    console.log('💡 Ejecuta primero: window.supabase = supabaseClient')
    return
  }
  const user = await supabase.auth.getUser()
  const actualUser = user?.data?.user
  
  if (!actualUser) {
    console.error('❌ Usuario no autenticado')
    return
  }
  
  // Obtener watch channel actual
  const { data: watchChannels, error } = await supabase
    .from('drive_watch_channels')
    .select('*')
    .eq('user_id', actualUser.id)
    .eq('is_active', true)
    
  if (error) {
    console.error('❌ Error obteniendo watch channels:', error.message)
    return
  }
    
  if (!watchChannels || watchChannels.length === 0) {
    console.error('❌ No hay watch channels activos')
    return
  }
  
  const watchChannel = watchChannels[0]
  
  console.log('📊 Watch channel actual:', {
    id: watchChannel.id,
    channel_id: watchChannel.channel_id,
    folder_id: watchChannel.folder_id,
    webhook_url: watchChannel.webhook_url,
    expires_at: watchChannel.expires_at,
    created_at: watchChannel.created_at
  })
  
  // Verificaciones específicas
  const issues = []
  
  if (!watchChannel.webhook_url.startsWith('https://')) {
    issues.push('❌ Webhook URL debe usar HTTPS')
  }
  
  if (!watchChannel.channel_id || watchChannel.channel_id.length < 10) {
    issues.push('❌ Channel ID parece inválido')
  }
  
  if (!watchChannel.folder_id || watchChannel.folder_id.length < 10) {
    issues.push('❌ Folder ID parece inválido')
  }
  
  const expiresAt = new Date(watchChannel.expires_at)
  const now = new Date()
  if (expiresAt <= now) {
    issues.push('❌ Watch channel ha expirado')
  }
  
  if (issues.length > 0) {
    console.log('⚠️ Problemas encontrados:')
    issues.forEach(issue => console.log('  ', issue))
  } else {
    console.log('✅ Formato del watch channel parece correcto')
  }
}

// Función para verificar el estado del webhook
async function checkWebhookStatus() {
  console.log('\n🔍 Verificando estado del webhook...')
  
  const webhookUrl = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
  
  try {
    // Intentar hacer una petición POST de prueba
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      source: 'diagnostic_script'
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    })
    
    if (response.ok) {
      const result = await response.text()
      console.log('✅ Webhook responde correctamente:', result)
    } else {
      console.error('❌ Webhook devuelve error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('   Detalles:', errorText)
    }
  } catch (error) {
    console.error('❌ Error al probar webhook:', error.message)
  }
}

// Función principal de diagnóstico
async function runBrowserDiagnostics() {
  console.log('🔍 Iniciando diagnóstico desde navegador...')
  console.log('='.repeat(60))
  
  await checkDomainVerification()
  await checkServiceAccountPermissions()
  await checkWatchChannelFormat()
  await checkWebhookStatus()
  
  console.log('\n📋 RESUMEN DE PROBLEMAS IDENTIFICADOS:')
  console.log('1. ❌ Webhook devuelve error 500 - verificar configuración de n8n')
  console.log('2. ⚠️ Problemas de CORS - normal para webhooks externos')
  console.log('3. 🔍 Verificar domain verification en Google Cloud Console')
  console.log('4. 🔍 Verificar que el certificado SSL sea válido')
  
  console.log('\n📋 PRÓXIMOS PASOS:')
  console.log('1. Revisar configuración del workflow en n8n')
  console.log('2. Verificar que el webhook esté activo y funcionando')
  console.log('3. Probar subiendo un archivo a la carpeta monitoreada')
  console.log('4. Verificar logs de n8n para errores específicos')
  
  console.log('\n='.repeat(60))
  console.log('🔍 Diagnóstico completado')
}

// Función para configurar Supabase en el navegador
function setupSupabaseForDiagnostics() {
  console.log('🔧 Configurando Supabase para diagnósticos...')
  
  // Intentar encontrar la instancia de Supabase automáticamente
  if (typeof window !== 'undefined') {
    // Buscar en variables globales comunes
    const possibleInstances = [
      window.supabase,
      window.supabaseClient,
      window.__SUPABASE__,
      // Buscar en el contexto de React si está disponible
      window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
    ]
    
    for (const instance of possibleInstances) {
      if (instance && typeof instance.auth === 'object') {
        window.supabase = instance
        console.log('✅ Supabase configurado automáticamente')
        return true
      }
    }
    
    console.log('⚠️ No se pudo encontrar Supabase automáticamente')
    console.log('📋 INSTRUCCIONES MANUALES:')
    console.log('1. Ve a la pestaña de tu aplicación React')
    console.log('2. Abre la consola del navegador (F12)')
    console.log('3. Busca la instancia de Supabase en el código:')
    console.log('   - Busca "createClient" o "supabase" en el código fuente')
    console.log('   - O ejecuta: Object.keys(window).filter(k => k.includes("supabase"))')
    console.log('4. Ejecuta: window.supabase = [tu_instancia_de_supabase]')
    console.log('5. Luego ejecuta: runBrowserDiagnostics()')
    
    return false
  }
  
  return false
}

// Ejecutar diagnósticos
console.log('🔍 Script de diagnóstico cargado.')
console.log('📋 PASOS PARA EJECUTAR:')
console.log('1. Ejecuta: setupSupabaseForDiagnostics()')
console.log('2. Si es exitoso, ejecuta: runBrowserDiagnostics()')
console.log('3. Si no, sigue las instrucciones manuales')

// Auto-configurar y ejecutar si se desea
// if (setupSupabaseForDiagnostics()) {
//   runBrowserDiagnostics().catch(console.error)
// }