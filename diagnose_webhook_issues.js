// Script para diagnosticar problemas específicos de webhooks de Google Drive
// Basado en problemas comunes identificados en la documentación y Stack Overflow

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
  
  // Verificar SSL
  try {
    const response = await fetch(webhookUrl, { method: 'HEAD' })
    console.log('✅ Webhook responde correctamente')
  } catch (error) {
    console.error('❌ Error al acceder al webhook:', error.message)
  }
}

// Función para verificar permisos del service account
async function checkServiceAccountPermissions() {
  console.log('\n🔍 Verificando permisos del Service Account...')
  
  const supabase = await getSupabase()
  const user = supabase.auth.getUser ? await supabase.auth.getUser() : await supabase.auth.user()
  const actualUser = user?.data?.user || user
  
  if (!actualUser) {
    console.error('❌ Usuario no autenticado')
    return
  }
  
  // Obtener credenciales
  const { data: credentials } = await supabase
    .from('user_credentials')
    .select('google_access_token, google_refresh_token')
    .eq('user_id', actualUser.id)
    .single()
    
  if (!credentials?.google_access_token) {
    console.error('❌ No hay token de acceso de Google')
    return
  }
  
  // Obtener carpeta administrador
  const { data: adminFolder } = await supabase
    .from('carpeta_administrador')
    .select('id_drive_carpeta')
    .eq('user_id', actualUser.id)
    .single()
    
  if (!adminFolder?.id_drive_carpeta) {
    console.error('❌ No hay carpeta administrador')
    return
  }
  
  console.log('📁 Carpeta a monitorear:', adminFolder.id_drive_carpeta)
  
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
      console.error('❌ Error al acceder a la carpeta:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('❌ Error verificando permisos:', error.message)
  }
}

// Función para verificar el formato del watch channel
async function checkWatchChannelFormat() {
  console.log('\n🔍 Verificando formato del watch channel...')
  
  const supabase = await getSupabase()
  const user = supabase.auth.getUser ? await supabase.auth.getUser() : await supabase.auth.user()
  const actualUser = user?.data?.user || user
  
  if (!actualUser) {
    console.error('❌ Usuario no autenticado')
    return
  }
  
  // Obtener watch channel actual
  const { data: watchChannel } = await supabase
    .from('drive_watch_channels')
    .select('*')
    .eq('user_id', actualUser.id)
    .eq('is_active', true)
    .single()
    
  if (!watchChannel) {
    console.error('❌ No hay watch channel activo')
    return
  }
  
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

// Función para probar creación de watch channel con formato correcto
async function testCorrectWatchChannelCreation() {
  console.log('\n🧪 Probando creación de watch channel con formato correcto...')
  
  const supabase = await getSupabase()
  const user = supabase.auth.getUser ? await supabase.auth.getUser() : await supabase.auth.user()
  const actualUser = user?.data?.user || user
  
  if (!actualUser) {
    console.error('❌ Usuario no autenticado')
    return
  }
  
  // Obtener credenciales y carpeta
  const { data: credentials } = await supabase
    .from('user_credentials')
    .select('google_access_token')
    .eq('user_id', actualUser.id)
    .single()
    
  const { data: adminFolder } = await supabase
    .from('carpeta_administrador')
    .select('id_drive_carpeta')
    .eq('user_id', actualUser.id)
    .single()
    
  if (!credentials?.google_access_token || !adminFolder?.id_drive_carpeta) {
    console.error('❌ Faltan credenciales o carpeta administrador')
    return
  }
  
  // Crear watch channel con formato correcto según documentación
  const channelId = crypto.randomUUID()
  const watchData = {
    id: channelId,
    type: 'web_hook',
    address: 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135',
    // NO incluir resourceId ni resourceUri según Stack Overflow
    // Solo id, type y address son necesarios
  }
  
  console.log('📡 Creando watch channel con datos:', watchData)
  
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${adminFolder.id_drive_carpeta}/watch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.google_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(watchData)
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Watch channel creado exitosamente:', result)
      
      // Guardar en base de datos
      const { error } = await supabase
        .from('drive_watch_channels')
        .insert({
          id: crypto.randomUUID(),
          channel_id: result.id,
          folder_id: adminFolder.id_drive_carpeta,
          user_id: actualUser.id,
          webhook_url: watchData.address,
          expires_at: new Date(result.expiration).toISOString(),
          is_active: true
        })
        
      if (error) {
        console.error('❌ Error guardando en BD:', error)
      } else {
        console.log('✅ Watch channel guardado en base de datos')
      }
    } else {
      const errorData = await response.text()
      console.error('❌ Error creando watch channel:', response.status, errorData)
      
      // Analizar errores específicos
      if (errorData.includes('webhookUrlUnauthorized')) {
        console.log('💡 Solución: Verificar domain verification en Google Cloud Console')
      }
      if (errorData.includes('insufficientPermissions')) {
        console.log('💡 Solución: Verificar permisos del service account')
      }
    }
  } catch (error) {
    console.error('❌ Error en la petición:', error.message)
  }
}

// Función principal de diagnóstico
async function runWebhookDiagnostics() {
  console.log('🔍 Iniciando diagnóstico avanzado de webhooks...')
  console.log('='.repeat(60))
  
  await checkDomainVerification()
  await checkServiceAccountPermissions()
  await checkWatchChannelFormat()
  await testCorrectWatchChannelCreation()
  
  console.log('\n📋 RESUMEN DE ACCIONES REQUERIDAS:')
  console.log('1. Verificar domain verification en Google Cloud Console')
  console.log('2. Verificar que el dominio tenga certificado SSL válido')
  console.log('3. Verificar permisos del service account en Google Drive')
  console.log('4. Recrear watch channel si es necesario')
  console.log('5. Probar subiendo un archivo a la carpeta monitoreada')
  
  console.log('\n='.repeat(60))
  console.log('🔍 Diagnóstico completado')
}

// Función auxiliar para obtener Supabase (reutilizar del script anterior)
async function getSupabase() {
  // Para Node.js, usar require en lugar de import dinámico
  const { createClient } = require('@supabase/supabase-js')
  
  const supabaseUrl = 'https://leoyybfbnjajkktprhro.supabase.co'
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb3l5YmZibmphamtrdHByaHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ0MTYsImV4cCI6MjA2NDM5MDQxNn0.VfJoDIHgXB1k4kwgndmr2yLNDeDBBIrOVsbqaSWrjHU'
  
  return createClient(supabaseUrl, supabaseKey)
}

// Ejecutar diagnósticos
console.log('🔍 Iniciando diagnóstico completo de webhooks de Google Drive...')
runWebhookDiagnostics().catch(console.error)