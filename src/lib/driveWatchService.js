import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

/**
 * Servicio para gestionar los watch channels de Google Drive
 */
export class DriveWatchService {
  static WEBHOOK_URL = 'https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135'
  
  /**
   * Crear un nuevo watch channel para una carpeta de Google Drive
   * @param {string} userId - ID del usuario
   * @param {string} folderId - ID de la carpeta de Google Drive
   * @param {string} accessToken - Token de acceso de Google Drive
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async createWatchChannel(userId, folderId, accessToken) {
    try {
      const channelId = uuidv4()
      
      // Configurar el watch en Google Drive API
      const watchResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/watch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: this.WEBHOOK_URL,
          token: userId
        })
      })
      
      if (!watchResponse.ok) {
        const error = await watchResponse.text()
        throw new Error(`Error configurando watch: ${error}`)
      }
      
      const watchData = await watchResponse.json()
      
      // Guardar el channel en Supabase
      const { data, error } = await supabase
        .from('drive_watch_channels')
        .insert({
          user_id: userId,
          folder_id: folderId,
          channel_id: channelId,
          resource_id: watchData.resourceId,
          webhook_url: this.WEBHOOK_URL,
          expiration: watchData.expiration ? new Date(parseInt(watchData.expiration)) : null,
          is_active: true
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error guardando watch channel:', error)
        // Intentar cancelar el watch en Google Drive si falló guardar en DB
        await this.cancelWatchChannel(channelId, watchData.resourceId, accessToken)
        throw new Error(`Error guardando watch channel: ${error.message}`)
      }
      
      return {
        success: true,
        data: {
          channelId,
          resourceId: watchData.resourceId,
          expiration: watchData.expiration,
          dbRecord: data
        }
      }
    } catch (error) {
      console.error('Error creando watch channel:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Cancelar un watch channel existente
   * @param {string} channelId - ID del canal
   * @param {string} resourceId - ID del recurso
   * @param {string} accessToken - Token de acceso de Google Drive
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async cancelWatchChannel(channelId, resourceId, accessToken) {
    try {
      // Cancelar el watch en Google Drive API
      const cancelResponse = await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: channelId,
          resourceId: resourceId
        })
      })
      
      if (!cancelResponse.ok) {
        const error = await cancelResponse.text()
        console.warn(`Error cancelando watch en Google Drive: ${error}`)
      }
      
      // Marcar como inactivo en Supabase
      const { error } = await supabase
        .from('drive_watch_channels')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('channel_id', channelId)
      
      if (error) {
        console.error('Error actualizando watch channel en DB:', error)
        throw new Error(`Error actualizando watch channel: ${error.message}`)
      }
      
      return {
        success: true,
        message: 'Watch channel cancelado exitosamente'
      }
    } catch (error) {
      console.error('Error cancelando watch channel:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Renovar un watch channel antes de que expire
   * @param {string} channelId - ID del canal a renovar
   * @param {string} accessToken - Token de acceso de Google Drive
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async renewWatchChannel(channelId, accessToken) {
    try {
      // Obtener información del watch channel actual
      const { data: currentChannel, error: fetchError } = await supabase
        .from('drive_watch_channels')
        .select('*')
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .single()
      
      if (fetchError || !currentChannel) {
        throw new Error('Watch channel no encontrado')
      }
      
      // Cancelar el watch actual
      await this.cancelWatchChannel(channelId, currentChannel.resource_id, accessToken)
      
      // Crear un nuevo watch
      const renewResult = await this.createWatchChannel(
        currentChannel.user_id,
        currentChannel.folder_id,
        accessToken
      )
      
      return renewResult
    } catch (error) {
      console.error('Error renovando watch channel:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Obtener todos los watch channels de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Lista de watch channels
   */
  static async getUserWatchChannels(userId) {
    try {
      const { data, error } = await supabase
        .from('drive_watch_channels')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (error) {
        throw new Error(`Error obteniendo watch channels: ${error.message}`)
      }
      
      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      console.error('Error obteniendo watch channels:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Limpiar watch channels expirados
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async cleanupExpiredChannels() {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_expired_watch_channels')
      
      if (error) {
        throw new Error(`Error limpiando channels expirados: ${error.message}`)
      }
      
      return {
        success: true,
        cleanedCount: data
      }
    } catch (error) {
      console.error('Error limpiando channels expirados:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Obtener notificaciones de Google Drive para un usuario
   * @param {string} userId - ID del usuario
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Object>} Lista de notificaciones
   */
  static async getUserNotifications(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('drive_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        throw new Error(`Error obteniendo notificaciones: ${error.message}`)
      }
      
      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Marcar notificaciones como procesadas
   * @param {Array<string>} notificationIds - IDs de las notificaciones
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async markNotificationsAsProcessed(notificationIds) {
    try {
      const { error } = await supabase
        .from('drive_notifications')
        .update({ processed: true })
        .in('id', notificationIds)
      
      if (error) {
        throw new Error(`Error marcando notificaciones: ${error.message}`)
      }
      
      return {
        success: true,
        message: 'Notificaciones marcadas como procesadas'
      }
    } catch (error) {
      console.error('Error marcando notificaciones:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default DriveWatchService