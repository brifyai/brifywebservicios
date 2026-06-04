// Procesador de notificaciones de Google Drive
// Maneja las notificaciones recibidas del webhook y extrae información detallada

import { supabase } from './supabase.js';

class DriveNotificationProcessor {
  /**
   * Procesa una notificación de Google Drive recibida del webhook
   * @param {Object} webhookData - Datos recibidos del webhook de n8n
   * @returns {Object} Información procesada de la notificación
   */
  static async processNotification(webhookData) {
    try {
      console.log('📨 Procesando notificación de Google Drive:', webhookData);
      
      // Extraer headers importantes
      const headers = webhookData.headers || {};
      
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
      const changeType = this.determineChangeType(notificationInfo);
      console.log('🔍 Tipo de cambio detectado:', changeType);
      
      // Obtener detalles del archivo/carpeta si es necesario
      let fileDetails = null;
      if (notificationInfo.resourceUri && changeType !== 'unknown') {
        fileDetails = await this.getFileDetails(notificationInfo.resourceUri, notificationInfo.channelId);
      }
      
      // Guardar la notificación en la base de datos
      const savedNotification = await this.saveNotification({
        ...notificationInfo,
        changeType,
        fileDetails
      });
      
      // Procesar según el tipo de cambio
      await this.handleChangeType(changeType, fileDetails, notificationInfo);
      
      return {
        success: true,
        notificationInfo,
        changeType,
        fileDetails,
        savedNotification
      };
      
    } catch (error) {
      console.error('❌ Error procesando notificación:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Determina el tipo de cambio basado en los headers
   * @param {Object} notificationInfo - Información de la notificación
   * @returns {string} Tipo de cambio
   */
  static determineChangeType(notificationInfo) {
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
  static async getFileDetails(resourceUri, channelId) {
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
   * Guarda la notificación en la base de datos
   * @param {Object} notificationData - Datos de la notificación
   * @returns {Object} Notificación guardada
   */
  static async saveNotification(notificationData) {
    try {
      // Obtener el watch channel para asociar con el usuario
      const { data: watchChannel } = await supabase
        .from('drive_watch_channels')
        .select('id, user_id')
        .eq('channel_id', notificationData.channelId)
        .eq('is_active', true)
        .single();
      
      if (!watchChannel) {
        throw new Error(`Watch channel no encontrado para channel_id: ${notificationData.channelId}`);
      }
      
      const { data: notification, error } = await supabase
        .from('drive_notifications')
        .insert({
          watch_channel_id: watchChannel.id,
          user_id: watchChannel.user_id,
          channel_id: notificationData.channelId,
          resource_state: notificationData.resourceState,
          resource_id: notificationData.resourceId,
          resource_uri: notificationData.resourceUri,
          changed_files: notificationData.changedType,
          notification_data: {
            changeType: notificationData.changeType,
            messageNumber: notificationData.messageNumber,
            channelToken: notificationData.channelToken,
            fileDetails: notificationData.fileDetails,
            timestamp: notificationData.timestamp
          },
          processed_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Notificación guardada en BD:', notification.id);
      return notification;
      
    } catch (error) {
      console.error('❌ Error guardando notificación:', error);
      throw error;
    }
  }
  
  /**
   * Maneja diferentes tipos de cambios
   * @param {string} changeType - Tipo de cambio
   * @param {Object} fileDetails - Detalles del archivo
   * @param {Object} notificationInfo - Información de la notificación
   */
  static async handleChangeType(changeType, fileDetails, notificationInfo) {
    console.log(`🔄 Manejando cambio tipo: ${changeType}`);
    
    switch (changeType) {
      case 'file_added_or_removed':
        await this.handleFileAddedOrRemoved(fileDetails, notificationInfo);
        break;
        
      case 'file_modified':
        await this.handleFileModified(fileDetails, notificationInfo);
        break;
        
      case 'permissions_changed':
        await this.handlePermissionsChanged(fileDetails, notificationInfo);
        break;
        
      case 'file_trashed':
        await this.handleFileTrash(fileDetails, notificationInfo);
        break;
        
      default:
        console.log(`ℹ️ Tipo de cambio no manejado específicamente: ${changeType}`);
    }
  }
  
  /**
   * Maneja archivos agregados o eliminados
   */
  static async handleFileAddedOrRemoved(fileDetails, notificationInfo) {
    if (fileDetails) {
      console.log(`📁 ${fileDetails.isFolder ? 'Carpeta' : 'Archivo'} detectado: ${fileDetails.name}`);
      
      if (!fileDetails.isFolder) {
        console.log('📄 Nuevo archivo para procesar:', {
          name: fileDetails.name,
          size: fileDetails.size,
          mimeType: fileDetails.mimeType,
          link: fileDetails.webViewLink
        });
        
        // Aquí puedes agregar lógica para procesar el archivo
        // Por ejemplo, extraer contenido, generar embeddings, etc.
      }
    } else {
      console.log('📭 Cambio en children detectado pero no se pudieron obtener detalles del archivo');
    }
  }
  
  /**
   * Maneja archivos modificados
   */
  static async handleFileModified(fileDetails, notificationInfo) {
    if (fileDetails && !fileDetails.isFolder) {
      console.log('✏️ Archivo modificado:', fileDetails.name);
      // Lógica para manejar archivos modificados
    }
  }
  
  /**
   * Maneja cambios de permisos
   */
  static async handlePermissionsChanged(fileDetails, notificationInfo) {
    console.log('🔐 Permisos cambiados en:', fileDetails?.name || 'archivo desconocido');
  }
  
  /**
   * Maneja archivos movidos a la papelera
   */
  static async handleFileTrash(fileDetails, notificationInfo) {
    console.log('🗑️ Archivo movido a papelera:', fileDetails?.name || 'archivo desconocido');
  }
}

export default DriveNotificationProcessor;