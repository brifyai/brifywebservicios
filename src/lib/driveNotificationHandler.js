// Servicio para manejar las notificaciones del webhook de Google Drive
// Este servicio procesa las notificaciones recibidas de n8n cuando hay cambios en las carpetas monitoreadas

import { supabase } from './supabase'

class DriveNotificationHandler {
  constructor() {
    this.isProcessing = false
  }

  /**
   * Procesa una notificación recibida del webhook de Google Drive
   * @param {Object} notificationData - Datos de la notificación del webhook
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processNotification(notificationData) {
    try {
      console.log('Procesando notificación de Google Drive:', notificationData)
      
      // Validar datos de entrada
      if (!notificationData || !notificationData.channel_id) {
        throw new Error('Datos de notificación inválidos: falta channel_id')
      }

      const {
        channel_id,
        resource_id,
        resource_state,
        resource_uri,
        changed_files = [],
        event_type = 'unknown',
        folder_id
      } = notificationData

      // Buscar el canal de watch en la base de datos
      const { data: watchChannel, error: channelError } = await supabase
        .from('drive_watch_channels')
        .select('*')
        .eq('channel_id', channel_id)
        .eq('is_active', true)
        .single()

      if (channelError || !watchChannel) {
        console.error('Canal de watch no encontrado o inactivo:', channelError)
        return {
          success: false,
          error: 'Canal de watch no encontrado o inactivo',
          channel_id
        }
      }

      // Verificar que el canal no haya expirado
      const now = Date.now()
      if (watchChannel.expiration && watchChannel.expiration < now) {
        console.warn('Canal de watch expirado:', channel_id)
        
        // Marcar canal como inactivo
        await supabase
          .from('drive_watch_channels')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', watchChannel.id)
        
        return {
          success: false,
          error: 'Canal de watch expirado',
          channel_id
        }
      }

      // Guardar la notificación en la base de datos
      const notificationRecord = {
        channel_id,
        resource_id,
        resource_state,
        resource_uri,
        changed_files: Array.isArray(changed_files) ? changed_files : [],
        notification_data: notificationData,
        user_id: watchChannel.user_id,
        folder_id: folder_id || watchChannel.folder_id,
        processed: false
      }

      const { data: savedNotification, error: saveError } = await supabase
        .from('drive_notifications')
        .insert(notificationRecord)
        .select()
        .single()

      if (saveError) {
        console.error('Error guardando notificación:', saveError)
        throw new Error(`Error guardando notificación: ${saveError.message}`)
      }

      console.log('Notificación guardada exitosamente:', savedNotification.id)

      // Procesar la notificación según el tipo de evento
      const processingResult = await this.processNotificationByType(
        savedNotification,
        watchChannel
      )

      // Marcar notificación como procesada si fue exitosa
      if (processingResult.success) {
        await supabase
          .from('drive_notifications')
          .update({ 
            processed: true, 
            processed_at: new Date().toISOString() 
          })
          .eq('id', savedNotification.id)
      }

      return {
        success: true,
        notification_id: savedNotification.id,
        processing_result: processingResult,
        channel_id
      }

    } catch (error) {
      console.error('Error procesando notificación:', error)
      return {
        success: false,
        error: error.message,
        channel_id: notificationData?.channel_id
      }
    }
  }

  /**
   * Procesa la notificación según el tipo de evento
   * @param {Object} notification - Registro de notificación
   * @param {Object} watchChannel - Canal de watch
   * @returns {Promise<Object>} Resultado del procesamiento específico
   */
  async processNotificationByType(notification, watchChannel) {
    try {
      const { resource_state, changed_files, notification_data } = notification
      
      console.log(`Procesando evento tipo: ${resource_state}`)

      switch (resource_state) {
        case 'add':
          return await this.handleFileAdded(notification, watchChannel)
        
        case 'remove':
        case 'trash':
          return await this.handleFileRemoved(notification, watchChannel)
        
        case 'update':
          return await this.handleFileUpdated(notification, watchChannel)
        
        case 'move':
          return await this.handleFileMoved(notification, watchChannel)
        
        case 'sync':
          return await this.handleSyncEvent(notification, watchChannel)
        
        default:
          console.log(`Tipo de evento no manejado: ${resource_state}`)
          return {
            success: true,
            message: `Evento ${resource_state} registrado pero no procesado`,
            action: 'logged_only'
          }
      }
    } catch (error) {
      console.error('Error en procesamiento específico:', error)
      return {
        success: false,
        error: error.message,
        action: 'error'
      }
    }
  }

  /**
   * Maneja eventos de archivos agregados
   */
  async handleFileAdded(notification, watchChannel) {
    console.log('Procesando archivo agregado:', notification.changed_files)
    
    // Aquí puedes agregar lógica específica para archivos agregados
    // Por ejemplo: actualizar contadores, enviar notificaciones, etc.
    
    return {
      success: true,
      message: 'Archivo agregado procesado',
      action: 'file_added',
      files_count: notification.changed_files?.length || 0
    }
  }

  /**
   * Maneja eventos de archivos eliminados
   */
  async handleFileRemoved(notification, watchChannel) {
    console.log('Procesando archivo eliminado:', notification.changed_files)
    
    return {
      success: true,
      message: 'Archivo eliminado procesado',
      action: 'file_removed',
      files_count: notification.changed_files?.length || 0
    }
  }

  /**
   * Maneja eventos de archivos actualizados
   */
  async handleFileUpdated(notification, watchChannel) {
    console.log('Procesando archivo actualizado:', notification.changed_files)
    
    return {
      success: true,
      message: 'Archivo actualizado procesado',
      action: 'file_updated',
      files_count: notification.changed_files?.length || 0
    }
  }

  /**
   * Maneja eventos de archivos movidos
   */
  async handleFileMoved(notification, watchChannel) {
    console.log('Procesando archivo movido:', notification.changed_files)
    
    return {
      success: true,
      message: 'Archivo movido procesado',
      action: 'file_moved',
      files_count: notification.changed_files?.length || 0
    }
  }

  /**
   * Maneja eventos de sincronización
   */
  async handleSyncEvent(notification, watchChannel) {
    console.log('Procesando evento de sincronización')
    
    return {
      success: true,
      message: 'Evento de sincronización procesado',
      action: 'sync_processed'
    }
  }

  /**
   * Obtiene notificaciones pendientes para un usuario
   * @param {string} userId - ID del usuario
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Lista de notificaciones pendientes
   */
  async getPendingNotifications(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('drive_notifications')
        .select(`
          *,
          drive_watch_channels!inner(
            folder_id,
            user_id
          )
        `)
        .eq('drive_watch_channels.user_id', userId)
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error obteniendo notificaciones pendientes:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error en getPendingNotifications:', error)
      return []
    }
  }

  /**
   * Marca múltiples notificaciones como procesadas
   * @param {Array<string>} notificationIds - IDs de las notificaciones
   * @returns {Promise<Object>} Resultado de la operación
   */
  async markNotificationsAsProcessed(notificationIds) {
    try {
      const { data, error } = await supabase
        .from('drive_notifications')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString() 
        })
        .in('id', notificationIds)
        .select()

      if (error) {
        console.error('Error marcando notificaciones como procesadas:', error)
        return { success: false, error: error.message }
      }

      return {
        success: true,
        updated_count: data?.length || 0,
        updated_notifications: data
      }
    } catch (error) {
      console.error('Error en markNotificationsAsProcessed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Simula el procesamiento de un webhook (para testing)
   * Esta función simula lo que haría n8n al recibir una notificación de Google Drive
   * @param {Object} webhookPayload - Payload del webhook
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async simulateWebhookProcessing(webhookPayload) {
    console.log('Simulando procesamiento de webhook:', webhookPayload)
    
    // Transformar el payload del webhook al formato esperado
    const notificationData = {
      channel_id: webhookPayload.channelId || webhookPayload.channel_id,
      resource_id: webhookPayload.resourceId || webhookPayload.resource_id,
      resource_state: webhookPayload.resourceState || webhookPayload.resource_state || 'update',
      resource_uri: webhookPayload.resourceUri || webhookPayload.resource_uri,
      event_type: webhookPayload.eventType || webhookPayload.event_type || 'change',
      folder_id: webhookPayload.folderId || webhookPayload.folder_id,
      changed_files: webhookPayload.changedFiles || webhookPayload.changed_files || [],
      timestamp: webhookPayload.timestamp || Date.now()
    }

    return await this.processNotification(notificationData)
  }
}

export default DriveNotificationHandler