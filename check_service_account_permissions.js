// Script para verificar permisos del service account y configuración de Google Drive API
// Ejecutar en la consola del navegador

// Problemas identificados de las búsquedas web:
// 1. Domain verification ya NO es requerida (obsoleto desde 2019)
// 2. Service account necesita permisos específicos sobre la carpeta
// 3. El webhook URL debe usar HTTPS (✅ ya lo tenemos)
// 4. Posibles problemas con el token de acceso o scopes
// 5. Service account debe tener domain-wide delegation si es necesario

// 1. Verificar si el service account tiene acceso a la carpeta
async function checkServiceAccountAccess() {
  try {
    console.log('🔍 Verificando acceso del service account a la carpeta...')
    
    const { data: { user } } = await window.supabase.auth.getUser()
    if (!user) {
      console.error('❌ Usuario no autenticado')
      return
    }
    
    // Obtener carpeta de administrador
    const { data: adminFolder } = await window.supabase
      .from('admin_folders')
      .select('drive_folder_id, folder_name')
      .eq('user_id', user.id)
      .single()
    
    if (!adminFolder) {
      console.error('❌ No se encontró carpeta de administrador')
      return
    }
    
    // Obtener credenciales
    const { data: credentials } = await window.supabase
      .from('user_credentials')
      .select('google_access_token')
      .eq('user_id', user.id)
      .single()
    
    if (!credentials || !credentials.google_access_token) {
      console.error('❌ No hay credenciales de Google disponibles')
      return
    }
    
    console.log('📁 Verificando carpeta:', {
      folderId: adminFolder.drive_folder_id,
      folderName: adminFolder.folder_name
    })
    
    // Verificar que la carpeta existe y es accesible
    const folderResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${adminFolder.drive_folder_id}?fields=id,name,owners,permissions`, {
      headers: {
        'Authorization': `Bearer ${credentials.google_access_token}`
      }
    })
    
    if (folderResponse.ok) {
      const folderData = await folderResponse.json()
      console.log('✅ Carpeta accesible:', {
        id: folderData.id,
        name: folderData.name,
        owners: folderData.owners?.map(o => o.emailAddress),
        hasPermissions: !!folderData.permissions
      })
      
      // Verificar permisos específicos
      if (folderData.permissions) {
        console.log('🔐 Permisos de la carpeta:', folderData.permissions)
      } else {
        console.warn('⚠️ No se pudieron obtener los permisos de la carpeta')
        console.log('💡 Esto puede indicar permisos insuficientes del token')
      }
      
      return folderData
    } else {
      const error = await folderResponse.text()
      console.error('❌ Error accediendo a la carpeta:', folderResponse.status, error)
      
      if (folderResponse.status === 404) {
        console.log('💡 Solución: La carpeta no existe o no es accesible')
      } else if (folderResponse.status === 403) {
        console.log('💡 Solución: Permisos insuficientes para acceder a la carpeta')
      }
    }
  } catch (error) {
    console.error('❌ Error en checkServiceAccountAccess:', error)
  }
}

// 2. Verificar scopes del token de acceso
async function checkTokenScopes() {
  try {
    console.log('🔍 Verificando scopes del token de acceso...')
    
    const { data: { user } } = await window.supabase.auth.getUser()
    if (!user) {
      console.error('❌ Usuario no autenticado')
      return
    }
    
    const { data: credentials } = await window.supabase
      .from('user_credentials')
      .select('google_access_token')
      .eq('user_id', user.id)
      .single()
    
    if (!credentials || !credentials.google_access_token) {
      console.error('❌ No hay credenciales de Google disponibles')
      return
    }
    
    // Verificar información del token
    const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${credentials.google_access_token}`)
    
    if (tokenInfoResponse.ok) {
      const tokenInfo = await tokenInfoResponse.json()
      console.log('🔑 Información del token:', {
        scope: tokenInfo.scope,
        expires_in: tokenInfo.expires_in,
        audience: tokenInfo.audience
      })
      
      // Verificar que tiene los scopes necesarios para Drive
      const requiredScopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
      
      const hasRequiredScopes = requiredScopes.some(scope => 
        tokenInfo.scope && tokenInfo.scope.includes(scope)
      )
      
      if (hasRequiredScopes) {
        console.log('✅ El token tiene scopes suficientes para Google Drive')
      } else {
        console.warn('⚠️ El token puede no tener scopes suficientes:', tokenInfo.scope)
        console.log('💡 Scopes requeridos:', requiredScopes)
      }
      
      return tokenInfo
    } else {
      const error = await tokenInfoResponse.text()
      console.error('❌ Error verificando token:', tokenInfoResponse.status, error)
    }
  } catch (error) {
    console.error('❌ Error en checkTokenScopes:', error)
  }
}

// 3. Probar la API de changes directamente
async function testChangesAPI() {
  try {
    console.log('🧪 Probando API de changes de Google Drive...')
    
    const { data: { user } } = await window.supabase.auth.getUser()
    if (!user) {
      console.error('❌ Usuario no autenticado')
      return
    }
    
    const { data: credentials } = await window.supabase
      .from('user_credentials')
      .select('google_access_token')
      .eq('user_id', user.id)
      .single()
    
    if (!credentials || !credentials.google_access_token) {
      console.error('❌ No hay credenciales de Google disponibles')
      return
    }
    
    // Obtener startPageToken
    console.log('📄 Obteniendo startPageToken...')
    const startPageResponse = await fetch('https://www.googleapis.com/drive/v3/changes/startPageToken', {
      headers: {
        'Authorization': `Bearer ${credentials.google_access_token}`
      }
    })
    
    if (startPageResponse.ok) {
      const startPageData = await startPageResponse.json()
      console.log('✅ StartPageToken obtenido:', startPageData.startPageToken)
      
      // Probar listar cambios
      console.log('📋 Probando listar cambios...')
      const changesResponse = await fetch(`https://www.googleapis.com/drive/v3/changes?pageToken=${startPageData.startPageToken}&includeRemoved=true`, {
        headers: {
          'Authorization': `Bearer ${credentials.google_access_token}`
        }
      })
      
      if (changesResponse.ok) {
        const changesData = await changesResponse.json()
        console.log('✅ API de changes funciona correctamente:', {
          nextPageToken: changesData.nextPageToken,
          changesCount: changesData.changes ? changesData.changes.length : 0
        })
        
        if (changesData.changes && changesData.changes.length > 0) {
          console.log('📊 Últimos cambios:', changesData.changes.slice(0, 3))
        }
        
        return { startPageToken: startPageData.startPageToken, changesData }
      } else {
        const error = await changesResponse.text()
        console.error('❌ Error listando cambios:', changesResponse.status, error)
      }
    } else {
      const error = await startPageResponse.text()
      console.error('❌ Error obteniendo startPageToken:', startPageResponse.status, error)
    }
  } catch (error) {
    console.error('❌ Error en testChangesAPI:', error)
  }
}

// 4. Verificar configuración actual de watch channels
async function analyzeWatchChannelConfig() {
  try {
    console.log('🔍 Analizando configuración de watch channels...')
    
    const { data: { user } } = await window.supabase.auth.getUser()
    if (!user) {
      console.error('❌ Usuario no autenticado')
      return
    }
    
    // Obtener watch channels activos
    const { data: watchChannels, error } = await window.supabase
      .from('drive_watch_channels')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
    
    if (error) {
      console.error('❌ Error consultando watch channels:', error)
      return
    }
    
    if (!watchChannels || watchChannels.length === 0) {
      console.warn('⚠️ No hay watch channels activos')
      console.log('💡 Solución: Crear un watch channel comprando un plan')
      return
    }
    
    console.log('📊 Watch channels activos encontrados:', watchChannels.length)
    
    for (const channel of watchChannels) {
      console.log('\n🔍 Analizando watch channel:', channel.id)
      console.log('📋 Configuración:', {
        channel_id: channel.channel_id,
        folder_id: channel.folder_id,
        webhook_url: channel.webhook_url,
        expiration: channel.expiration,
        created_at: channel.created_at
      })
      
      // Verificar si ha expirado
      const now = new Date()
      const expiration = channel.expiration ? new Date(channel.expiration) : null
      
      if (expiration) {
        const timeUntilExpiration = expiration.getTime() - now.getTime()
        const hoursUntilExpiration = Math.floor(timeUntilExpiration / (1000 * 60 * 60))
        
        if (timeUntilExpiration > 0) {
          console.log(`⏰ Expira en ${hoursUntilExpiration} horas (${expiration.toLocaleString()})`)
        } else {
          console.warn('⚠️ Watch channel ha expirado:', expiration.toLocaleString())
          console.log('💡 Solución: Renovar el watch channel')
        }
      } else {
        console.warn('⚠️ Watch channel sin fecha de expiración')
      }
      
      // Verificar URL del webhook
      const expectedWebhookUrl = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
      if (channel.webhook_url === expectedWebhookUrl) {
        console.log('✅ URL del webhook es correcta')
      } else {
        console.warn('⚠️ URL del webhook no coincide:', {
          actual: channel.webhook_url,
          expected: expectedWebhookUrl
        })
      }
    }
  } catch (error) {
    console.error('❌ Error en analyzeWatchChannelConfig:', error)
  }
}

// 5. Probar webhook manualmente
async function testWebhookManually() {
  try {
    console.log('🧪 Probando webhook manualmente...')
    
    const webhookUrl = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
    
    // Simular una notificación de Google Drive
    const testPayload = {
      kind: 'api#channel',
      id: 'test-notification-' + Date.now(),
      resourceId: 'test-resource-id',
      resourceUri: 'https://www.googleapis.com/drive/v3/changes?pageToken=test',
      token: 'test-user-id'
    }
    
    console.log('📡 Enviando notificación de prueba al webhook...')
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Channel-ID': testPayload.id,
        'X-Goog-Channel-Token': testPayload.token,
        'X-Goog-Resource-ID': testPayload.resourceId,
        'X-Goog-Resource-URI': testPayload.resourceUri,
        'X-Goog-Resource-State': 'update',
        'X-Goog-Changed': 'content'
      },
      body: JSON.stringify(testPayload)
    })
    
    console.log('📊 Respuesta del webhook:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })
    
    if (response.ok) {
      console.log('✅ Webhook responde correctamente')
      const responseText = await response.text()
      if (responseText) {
        console.log('📄 Respuesta del webhook:', responseText)
      }
    } else {
      console.warn('⚠️ Webhook no responde como esperado')
      const errorText = await response.text()
      console.log('❌ Error del webhook:', errorText)
    }
  } catch (error) {
    console.error('❌ Error probando webhook:', error)
    console.log('💡 Esto puede indicar que el webhook no está accesible')
  }
}

// Función principal de diagnóstico de permisos
async function runPermissionsDiagnostics() {
  console.log('🔍 Iniciando diagnóstico de permisos y configuración...')
  console.log('=' + '='.repeat(60))
  
  console.log('\n1️⃣ Verificando acceso del service account a la carpeta...')
  await checkServiceAccountAccess()
  
  console.log('\n2️⃣ Verificando scopes del token de acceso...')
  await checkTokenScopes()
  
  console.log('\n3️⃣ Probando API de changes de Google Drive...')
  await testChangesAPI()
  
  console.log('\n4️⃣ Analizando configuración de watch channels...')
  await analyzeWatchChannelConfig()
  
  console.log('\n5️⃣ Probando webhook manualmente...')
  await testWebhookManually()
  
  console.log('\n🔍 Diagnóstico de permisos completado')
  console.log('=' + '='.repeat(60))
  
  console.log('\n📚 Problemas comunes identificados:')
  console.log('   • Domain verification: YA NO ES NECESARIA (obsoleta desde 2019)')
  console.log('   • Service account: Debe tener acceso a la carpeta específica')
  console.log('   • Scopes: Debe incluir https://www.googleapis.com/auth/drive')
  console.log('   • HTTPS: El webhook debe usar HTTPS (✅ ya configurado)')
  console.log('   • Permisos: El usuario debe ser propietario o tener permisos en la carpeta')
  console.log('   • Token: Verificar que no haya expirado y tenga scopes correctos')
}

// Exportar funciones
window.runPermissionsDiagnostics = runPermissionsDiagnostics
window.checkServiceAccountAccess = checkServiceAccountAccess
window.checkTokenScopes = checkTokenScopes
window.testChangesAPI = testChangesAPI
window.analyzeWatchChannelConfig = analyzeWatchChannelConfig
window.testWebhookManually = testWebhookManually

console.log('🔐 Script de diagnóstico de permisos cargado.')
console.log('🚀 Ejecuta runPermissionsDiagnostics() para comenzar el diagnóstico de permisos.')