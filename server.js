const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://leoyybfbnjajkktprhro.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb3l5YmZibmphamtrdHByaHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ0MTYsImV4cCI6MjA2NDM5MDQxNn0.VfJoDIHgXB1k4kwgndmr2yLNDeDBBIrOVsbqaSWrjHU';
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
    const drive = google.drive({ version: 'v3' });
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,parents,owners,webViewLink',
      auth: new google.auth.OAuth2(),
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error obteniendo detalles del archivo:', error);
    return null;
  }
}

// Endpoint para recibir notificaciones de Google Drive desde n8n
app.post('/api/webhook/drive-notifications', async (req, res) => {
  try {
    console.log('📨 Notificación recibida desde n8n:', JSON.stringify(req.body, null, 2));
    
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
    // Buscar por 'channel_id' que es el campo que contiene el ID del canal de Google Drive
    const { data: watchChannel, error: watchError } = await supabase
      .from('drive_watch_channels')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();
    
    if (watchError || !watchChannel) {
      console.error('❌ Watch channel no encontrado:', watchError);
      console.error('❌ Detalles del error:', JSON.stringify(watchError, null, 2));
      return res.status(404).json({ 
        success: false, 
        error: 'Watch channel no encontrado o inactivo',
        details: watchError?.message 
      });
    }
    
    console.log('✅ Watch channel encontrado:', watchChannel);
    
    // Obtener credenciales de Google del usuario (opcional para esta prueba)
    let userCredentials = null;
    try {
      const { data, error } = await supabase
        .from('user_credentials')
        .select('google_access_token')
        .eq('user_id', watchChannel.user_id)
        .single();
      
      if (!error) {
        userCredentials = data;
        console.log('🔑 Credenciales obtenidas correctamente');
      } else {
        console.log('⚠️ No se pudieron obtener credenciales:', error.message);
      }
    } catch (err) {
      console.log('⚠️ Error al obtener credenciales:', err.message);
    }
    
    console.log('✅ Watch channel encontrado:', watchChannel.id);
    
    // Extraer ID del archivo de la URI
    const fileId = extractFileIdFromUri(resourceUri);
    console.log('📁 ID del archivo extraído:', fileId);
    
    // Obtener detalles del archivo si tenemos el ID
    let fileDetails = null;
    if (fileId && userCredentials?.google_access_token) {
      fileDetails = await getFileDetails(fileId, userCredentials.google_access_token);
      console.log('📋 Detalles del archivo:', fileDetails);
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
    
    console.log('🔄 Tipo de cambio determinado:', changeType);
    
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
    
    console.log('✅ Notificación guardada exitosamente:', savedNotification.id);
    
    // Respuesta exitosa
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
});

// Endpoint de prueba
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Servir archivos estáticos de React en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 Modo desarrollo: React debe ejecutarse por separado en puerto 3000');
  }
});