// Endpoint API para recibir notificaciones de Google Drive desde n8n
// Este endpoint procesa las notificaciones y las guarda en la base de datos

import { supabase } from '../../lib/supabase.js';

/**
 * Procesa notificaciones de Google Drive recibidas desde n8n
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
export default async function handler(req, res) {
  // Solo aceptar métodos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método no permitido. Solo se acepta POST.' 
    });
  }

  try {
    console.log('🎯 Webhook recibido desde n8n:', {
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    // Extraer datos del webhook
    const webhookData = req.body;
    
    // Validar que tenemos los datos necesarios
    if (!webhookData || !webhookData.headers) {
      console.error('❌ Datos de webhook inválidos: faltan headers');
      return res.status(400).json({
        success: false,
        error: 'Datos de webhook inválidos: faltan headers'
      });
    }

    // Extraer información de los headers de Google Drive
    const headers = webhookData.headers;
    const channelId = headers['x-goog-channel-id'];
    
    if (!channelId) {
      console.error('❌ No es una notificación válida de Google Drive: falta x-goog-channel-id');
      return res.status(400).json({
        success: false,
        error: 'No es una notificación válida de Google Drive: falta x-goog-channel-id'
      });
    }

    console.log(`📡 Procesando notificación del canal: ${channelId}`);

    // Extraer información de la notificación
    const notificationInfo = {
      channelId: headers['x-goog-channel-id'],
      channelExpiration: headers['x-goog-channel-expiration'],
      resourceState: headers['x-goog-resource-state'], // 'update', 'exists', 'not_exists', 'trash', 'sync'
      changedType: headers['x-goog-changed'], // 'children', 'parents', 'properties', 'permissions'
      messageNumber: headers['x-goog-message-number'],
      resourceId: headers['x-goog-resource-id'],
      resourceUri: headers['x-goog-resource-uri'],
      channelToken: headers['x-goog-channel-token'],
      timestamp: new Date().toISOString()
    };

    console.log('📊 Información extraída:', notificationInfo);

    // Determinar el tipo de cambio
    const changeType = determineChangeType(notificationInfo);
    console.log('🔍 Tipo de cambio detectado:', changeType);

    // Buscar el watch channel en la base de datos
    const { data: watchChannel, error: channelError } = await supabase
      .from('drive_watch_channels')
      .select('id, user_id')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();

    if (channelError || !watchChannel) {
      console.error('❌ Watch channel no encontrado:', channelError);
      return res.status(404).json({
        success: false,
        error: `Watch channel no encontrado para channel_id: ${channelId}`,
        channelId
      });
    }

    console.log('✅ Watch channel encontrado:', watchChannel);

    // Obtener detalles del archivo si es necesario
    let fileDetails = null;
    if (notificationInfo.resourceUri && changeType !== 'unknown') {
      fileDetails = await getFileDetails(notificationInfo.resourceUri, channelId);
    }

    // Guardar la notificación en la base de datos
    const { data: notification, error: saveError } = await supabase
      .from('drive_notifications')
      .insert({
        watch_channel_id: watchChannel.id,
        user_id: watchChannel.user_id,
        channel_id: channelId,
        resource_state: notificationInfo.resourceState,
        resource_id: notificationInfo.resourceId,
        resource_uri: notificationInfo.resourceUri,
        changed_files: notificationInfo.changedType,
        notification_data: {
          changeType,
          messageNumber: notificationInfo.messageNumber,
          channelToken: notificationInfo.channelToken,
          fileDetails,
          timestamp: notificationInfo.timestamp,
          originalWebhookData: webhookData
        },
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Error guardando notificación:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Error guardando notificación en la base de datos',
        details: saveError.message
      });
    }

    console.log('✅ Notificación guardada exitosamente:', notification.id);

    // Procesar según el tipo de cambio
    await handleChangeType(changeType, fileDetails, notificationInfo, watchChannel.user_id);

    // Respuesta exitosa
    return res.status(200).json({
      success: true,
      message: 'Notificación procesada correctamente',
      data: {
        notificationId: notification.id,
        changeType,
        fileName: fileDetails?.name,
        isFolder: fileDetails?.isFolder,
        timestamp: notificationInfo.timestamp
      }
    });

  } catch (error) {
    console.error('💥 Error procesando webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

/**
 * Determina el tipo de cambio basado en los headers
 * @param {Object} notificationInfo - Información de la notificación
 * @returns {string} Tipo de cambio
 */
function determineChangeType(notificationInfo) {
  const { resourceState, changedType } = notificationInfo;
  
  // Mapear estados y tipos de cambio
  if (resourceState === 'update' && changedType === 'children') {
    return 'file_added_or_removed'; // Archivo agregado o eliminado en la carpeta
  }
  
  if (resourceState === 'update' && changedType === 'properties') {
    return 'file_modified'; // Propiedades del archivo modificadas
  }
  
  if (resourceState === 'update' && changedType === 'permissions') {
    return 'permissions_changed'; // Permisos cambiados
  }
  
  if (resourceState === 'trash') {
    return 'file_trashed'; // Archivo movido a la papelera
  }
  
  if (resourceState === 'exists') {
    return 'file_exists'; // Confirmación de existencia
  }
  
  if (resourceState === 'not_exists') {
    return 'file_deleted'; // Archivo eliminado permanentemente
  }
  
  if (resourceState === 'sync') {
    return 'sync_event'; // Evento de sincronización
  }
  
  return 'unknown';
}

/**
 * Obtiene detalles del archivo desde Google Drive API
 * @param {string} resourceUri - URI del recurso
 * @param {string} channelId - ID del canal para obtener credenciales
 * @returns {Object|null} Detalles del archivo
 */
async function getFileDetails(resourceUri, channelId) {
  try {
    // Extraer el file ID de la URI
    const fileIdMatch = resourceUri.match(/files\/([^?]+)/);
    if (!fileIdMatch) {
      console.log('⚠️ No se pudo extraer file ID de:', resourceUri);
      return null;
    }
    
    const fileId = fileIdMatch[1];
    console.log('📁 Obteniendo detalles del archivo:', fileId);
    
    // Obtener credenciales del usuario basado en el channel ID
    const { data: watchChannel } = await supabase
      .from('drive_watch_channels')
      .select(`
        user_id,
        user_credentials!inner(
          google_access_token,
          google_refresh_token
        )
      `)
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();
    
    if (!watchChannel?.user_credentials?.google_access_token) {
      console.log('⚠️ No se encontraron credenciales para el canal:', channelId);
      return null;
    }
    
    // Hacer petición a Google Drive API
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,owners,webViewLink`,
      {
        headers: {
          'Authorization': `Bearer ${watchChannel.user_credentials.google_access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.log('⚠️ Error obteniendo detalles del archivo:', response.status, response.statusText);
      return null;
    }
    
    const fileDetails = await response.json();
    console.log('✅ Detalles del archivo obtenidos:', fileDetails);
    
    return {
      id: fileDetails.id,
      name: fileDetails.name,
      mimeType: fileDetails.mimeType,
      size: fileDetails.size,
      createdTime: fileDetails.createdTime,
      modifiedTime: fileDetails.modifiedTime,
      parents: fileDetails.parents,
      owners: fileDetails.owners,
      webViewLink: fileDetails.webViewLink,
      isFolder: fileDetails.mimeType === 'application/vnd.google-apps.folder'
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo detalles del archivo:', error);
    return null;
  }
}

/**
 * Maneja diferentes tipos de cambios
 * @param {string} changeType - Tipo de cambio
 * @param {Object} fileDetails - Detalles del archivo
 * @param {Object} notificationInfo - Información de la notificación
 * @param {string} userId - ID del usuario
 */
async function handleChangeType(changeType, fileDetails, notificationInfo, userId) {
  console.log(`🔄 Manejando cambio tipo: ${changeType} para usuario: ${userId}`);
  
  switch (changeType) {
    case 'file_added_or_removed':
      await handleFileAddedOrRemoved(fileDetails, notificationInfo, userId);
      break;
      
    case 'file_modified':
      await handleFileModified(fileDetails, notificationInfo, userId);
      break;
      
    case 'permissions_changed':
      await handlePermissionsChanged(fileDetails, notificationInfo, userId);
      break;
      
    case 'file_trashed':
      await handleFileTrash(fileDetails, notificationInfo, userId);
      break;
      
    default:
      console.log(`ℹ️ Tipo de cambio no manejado específicamente: ${changeType}`);
  }
}

/**
 * Maneja archivos agregados o eliminados
 */
async function handleFileAddedOrRemoved(fileDetails, notificationInfo, userId) {
  if (fileDetails) {
    console.log(`📁 ${fileDetails.isFolder ? 'Carpeta' : 'Archivo'} detectado: ${fileDetails.name}`);
    
    if (!fileDetails.isFolder) {
      console.log('📄 Nuevo archivo para procesar:', {
        name: fileDetails.name,
        size: fileDetails.size,
        mimeType: fileDetails.mimeType,
        link: fileDetails.webViewLink,
        userId
      });
      
      // Aquí puedes agregar lógica para procesar el archivo
      // Por ejemplo, extraer contenido, generar embeddings, etc.
      // await processNewFile(fileDetails, userId);
    }
  } else {
    console.log('📭 Cambio en children detectado pero no se pudieron obtener detalles del archivo');
  }
}

/**
 * Maneja archivos modificados
 */
async function handleFileModified(fileDetails, notificationInfo, userId) {
  if (fileDetails && !fileDetails.isFolder) {
    console.log('✏️ Archivo modificado:', fileDetails.name, 'Usuario:', userId);
    // Lógica para manejar archivos modificados
    // await processModifiedFile(fileDetails, userId);
  }
}

/**
 * Maneja cambios de permisos
 */
async function handlePermissionsChanged(fileDetails, notificationInfo, userId) {
  console.log('🔐 Permisos cambiados en:', fileDetails?.name || 'archivo desconocido', 'Usuario:', userId);
}

/**
 * Maneja archivos movidos a la papelera
 */
async function handleFileTrash(fileDetails, notificationInfo, userId) {
  console.log('🗑️ Archivo movido a papelera:', fileDetails?.name || 'archivo desconocido', 'Usuario:', userId);
}