const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

// Configuración de Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Función para extraer el ID del archivo de la URI de Google Drive
function extractFileIdFromUri(resourceUri) {
  if (!resourceUri) return null;
  
  // Buscar patrones comunes en las URIs de Google Drive
  const patterns = [
    /\/files\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/([a-zA-Z0-9_-]{25,})/
  ];
  
  for (const pattern of patterns) {
    const match = resourceUri.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Función para obtener detalles del archivo desde Google Drive API
async function getFileDetails(fileId, accessToken) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const drive = google.drive({ 
      version: 'v3',
      auth: oauth2Client
    });
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,parents,owners,webViewLink'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error obteniendo detalles del archivo:', error);
    return null;
  }
}

module.exports = async (req, res) => {
  // Configuración CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('📨 Notificación recibida desde n8n (Serverless):', JSON.stringify(req.body, null, 2));
    
    const { headers, body, processedData } = req.body;
    
    if (!headers) {
      return res.status(400).json({ 
        success: false, 
        error: 'Headers requeridos no encontrados' 
      });
    }
    
    // Extraer información de los headers
    const channelId = headers['x-goog-channel-id'];
    const resourceState = headers['x-goog-resource-state'];
    const resourceUri = headers['x-goog-resource-uri'];
    const changed = headers['x-goog-changed'];
    const messageNumber = headers['x-goog-message-number'];
    
    console.log('🔍 Datos extraídos:', {
      channelId,
      resourceState,
      resourceUri,
      changed,
      messageNumber
    });
    
    if (!channelId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Channel ID no encontrado en headers' 
      });
    }
    
    // Buscar el watch channel en la base de datos
    const { data: watchChannel, error: watchError } = await supabase
      .from('drive_watch_channels')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();
    
    if (watchError || !watchChannel) {
      console.error('❌ Watch channel no encontrado:', watchError);
      return res.status(404).json({ 
        success: false, 
        error: 'Watch channel no encontrado o inactivo',
        details: watchError?.message 
      });
    }
    
    console.log('✅ Watch channel encontrado:', watchChannel.id);
    
    // Obtener credenciales de Google del usuario
    let userCredentials = null;
    try {
      const { data, error } = await supabase
        .from('user_credentials')
        .select('google_access_token')
        .eq('user_id', watchChannel.user_id)
        .single();
      
      if (!error) {
        userCredentials = data;
      }
    } catch (err) {
      console.log('⚠️ Error al obtener credenciales:', err.message);
    }
    
    // Extraer ID del archivo de la URI
    const fileId = extractFileIdFromUri(resourceUri);
    
    // Obtener detalles del archivo si tenemos el ID
    let fileDetails = null;
    if (fileId && userCredentials?.google_access_token) {
      fileDetails = await getFileDetails(fileId, userCredentials.google_access_token);
    }
    
    // Determinar el tipo de cambio
    let changeType = 'unknown';
    if (resourceState === 'update') {
      if (changed === 'children') {
        changeType = 'file_added_or_removed';
      } else if (changed === 'content') {
        changeType = 'file_modified';
      } else if (changed === 'permissions') {
        changeType = 'permissions_changed';
      }
    } else if (resourceState === 'trash') {
      changeType = 'file_trashed';
    } else if (resourceState === 'sync') {
      changeType = 'sync_event';
    }
    
    // Guardar la notificación en la base de datos
    const notificationData = {
      channel_id: channelId,
      resource_state: resourceState,
      resource_uri: resourceUri,
      changed_files: changed,
      notification_data: {
        headers: headers,
        body: body,
        processedData: processedData,
        fileDetails: fileDetails,
        changeType: changeType,
        fileId: fileId
      },
      processed_at: new Date().toISOString()
    };
    
    const { data: savedNotification, error: saveError } = await supabase
      .from('drive_notifications')
      .insert(notificationData)
      .select()
      .single();
    
    if (saveError) {
      console.error('❌ Error guardando notificación:', saveError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error guardando notificación en la base de datos' 
      });
    }
    
    res.json({
      success: true,
      message: 'Notificación procesada exitosamente',
      data: {
        notificationId: savedNotification.id,
        changeType: changeType,
        fileId: fileId,
        fileName: fileDetails?.name || 'Desconocido',
        resourceState: resourceState,
        changed: changed
      }
    });
    
  } catch (error) {
    console.error('💥 Error procesando notificación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
};
