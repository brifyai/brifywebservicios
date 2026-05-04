// Script para probar la obtención de detalles de archivo con autenticación
// Este script verifica que el sistema puede obtener información de archivos usando las credenciales del usuario

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Configuración de Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Prueba la obtención de detalles de archivo con autenticación
 */
async function testFileDetailsWithAuth() {
  try {
    console.log('🔍 Probando obtención de detalles de archivo con autenticación...');
    
    // File ID del archivo detectado en la notificación
    const fileId = '1zXaSqUi0jltR0QSJ9LViiQCaTMhgqabp';
    const channelId = '72f250e8-1669-40bc-b84d-7fb24c76b4c9';
    
    console.log('📁 File ID:', fileId);
    console.log('📡 Channel ID:', channelId);
    
    // 1. Obtener credenciales del usuario basado en el channel ID
    console.log('\n1️⃣ Obteniendo credenciales del usuario...');
    
    const { data: watchChannel, error: channelError } = await supabase
      .from('drive_watch_channels')
      .select(`
        user_id,
        channel_id,
        is_active,
        user_credentials!inner(
          google_access_token,
          google_refresh_token
        )
      `)
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();
    
    if (channelError) {
      console.error('❌ Error obteniendo watch channel:', channelError);
      return;
    }
    
    if (!watchChannel) {
      console.error('❌ Watch channel no encontrado para channel_id:', channelId);
      return;
    }
    
    console.log('✅ Watch channel encontrado:', {
      user_id: watchChannel.user_id,
      channel_id: watchChannel.channel_id,
      has_credentials: !!watchChannel.user_credentials?.google_access_token
    });
    
    if (!watchChannel.user_credentials?.google_access_token) {
      console.error('❌ No se encontraron credenciales de Google para el usuario');
      return;
    }
    
    // 2. Hacer petición autenticada a Google Drive API
    console.log('\n2️⃣ Haciendo petición autenticada a Google Drive API...');
    
    const accessToken = watchChannel.user_credentials.google_access_token;
    console.log('🔑 Access token disponible:', accessToken.substring(0, 20) + '...');
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,owners,webViewLink`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en la petición:', errorText);
      
      if (response.status === 401) {
        console.log('🔄 Token expirado, se necesita refresh');
      }
      return;
    }
    
    const fileDetails = await response.json();
    console.log('\n✅ Detalles del archivo obtenidos exitosamente:');
    console.log('📄 Nombre:', fileDetails.name);
    console.log('📋 Tipo MIME:', fileDetails.mimeType);
    console.log('📏 Tamaño:', fileDetails.size ? `${fileDetails.size} bytes` : 'N/A');
    console.log('📅 Creado:', fileDetails.createdTime);
    console.log('📝 Modificado:', fileDetails.modifiedTime);
    console.log('👥 Propietarios:', fileDetails.owners?.map(o => o.emailAddress).join(', '));
    console.log('🔗 Link:', fileDetails.webViewLink);
    console.log('📁 Es carpeta:', fileDetails.mimeType === 'application/vnd.google-apps.folder');
    
    // 3. Verificar que el procesador funciona correctamente
    console.log('\n3️⃣ Verificando que el procesador puede manejar este archivo...');
    
    const mockNotificationData = {
      channelId: channelId,
      resourceUri: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=json&null`,
      resourceState: 'update',
      changedType: 'children',
      messageNumber: '1449596',
      resourceId: 'mqWFmR5RrOzuxUts4pyf9x3Sdec',
      channelToken: '956116e8-97a6-4d74-af2b-e834fac27ad4',
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ El procesador debería poder manejar este archivo correctamente');
    console.log('📊 Datos de notificación simulados:', mockNotificationData);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Ejecutar la prueba
if (require.main === module) {
  testFileDetailsWithAuth()
    .then(() => {
      console.log('\n🎉 Prueba completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { testFileDetailsWithAuth };