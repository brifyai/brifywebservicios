/**
 * Servicio para la renovación automática de tokens de Google Drive
 * Maneja la expiración y renovación proactiva de tokens de acceso
 */

import { supabase } from '../lib/supabase'

class TokenRefreshService {
  constructor() {
    this.refreshInProgress = new Map() // Para evitar múltiples renovaciones simultáneas
    this.tokenExpirationBuffer = 5 * 60 * 1000 // 5 minutos antes de la expiración
  }

  /**
   * Renovar token de acceso usando refresh_token
   * @param {string} refreshToken - Token de renovación
   * @returns {Object} - Nuevos tokens
   */
  async refreshAccessToken(refreshToken) {
    try {
      console.log('🔄 Renovando token de acceso...')
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.text()
        console.error('❌ Error renovando token de Google:', response.status, errorData)
        throw new Error(`Error renovando token: ${response.status} - ${errorData}`)
      }
      
      const refreshedTokens = await response.json()
      console.log('✅ Token renovado exitosamente')
      
      return {
        access_token: refreshedTokens.access_token,
        expires_in: refreshedTokens.expires_in || 3599, // Por defecto 1 hora
        scope: refreshedTokens.scope,
        token_type: refreshedTokens.token_type || 'Bearer'
      }
    } catch (error) {
      console.error('❌ Error en refreshAccessToken:', error)
      throw error
    }
  }

  /**
   * Calcular fecha de expiración del token
   * @param {number} expiresIn - Segundos hasta la expiración
   * @returns {string} - Fecha ISO de expiración
   */
  calculateExpirationDate(expiresIn) {
    const now = new Date()
    const expirationDate = new Date(now.getTime() + (expiresIn * 1000))
    return expirationDate.toISOString()
  }

  /**
   * Verificar si un token ha expirado o está próximo a expirar
   * @param {string} expirationDate - Fecha de expiración en formato ISO
   * @returns {boolean} - True si el token necesita renovación
   */
  needsRefresh(expirationDate) {
    if (!expirationDate) return true // Si no hay fecha, asumir que necesita renovación
    
    const now = new Date()
    const expiration = new Date(expirationDate)
    const timeUntilExpiration = expiration.getTime() - now.getTime()
    
    // Renovar si ya expiró o si está dentro del buffer de tiempo
    return timeUntilExpiration <= this.tokenExpirationBuffer
  }

  /**
   * Obtener y renovar token si es necesario para un usuario específico
   * @param {string} userId - ID del usuario
   * @returns {Object} - Token válido y datos de credenciales
   */
  async getValidToken(userId) {
    try {
      // Evitar múltiples renovaciones simultáneas para el mismo usuario
      if (this.refreshInProgress.has(userId)) {
        console.log('⏳ Renovación ya en progreso para usuario:', userId)
        await this.refreshInProgress.get(userId)
      }

      // Obtener credenciales actuales
      const { data: credentials, error } = await supabase
        .from('user_credentials')
        .select('google_access_token, google_refresh_token')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('❌ Error obteniendo credenciales:', error)
        throw new Error('No se pudieron obtener las credenciales de Google Drive')
      }

      if (!credentials) {
        throw new Error('No se encontraron credenciales de Google Drive para el usuario')
      }

      if (!credentials.google_refresh_token) {
        throw new Error('No se encontró refresh_token. Es necesario reconectar Google Drive')
      }

      // Verificar si el token necesita renovación
      // Como no tenemos fecha de expiración almacenada, intentaremos usar el token
      // y si falla, lo renovaremos
      if (credentials.google_access_token) {
        console.log('✅ Token disponible, intentando usar...')
        return {
          access_token: credentials.google_access_token,
          refresh_token: credentials.google_refresh_token,
          expires_at: null // No tenemos fecha de expiración almacenada
        }
      }

      // Iniciar proceso de renovación
      console.log('🔄 Token expirado o próximo a expirar, renovando...')
      const refreshPromise = this.performTokenRefresh(userId, credentials.google_refresh_token)
      this.refreshInProgress.set(userId, refreshPromise)

      try {
        const result = await refreshPromise
        return result
      } finally {
        this.refreshInProgress.delete(userId)
      }

    } catch (error) {
      console.error('❌ Error en getValidToken:', error)
      this.refreshInProgress.delete(userId)
      throw error
    }
  }

  /**
   * Realizar la renovación del token y actualizar la base de datos
   * @param {string} userId - ID del usuario
   * @param {string} refreshToken - Token de renovación
   * @returns {Object} - Nuevos tokens
   */
  async performTokenRefresh(userId, refreshToken) {
    try {
      // Renovar el token
      const newTokens = await this.refreshAccessToken(refreshToken)
      
      // Calcular nueva fecha de expiración
      const expiresAt = this.calculateExpirationDate(newTokens.expires_in)
      
      // Actualizar en la base de datos
      const { error: updateError } = await supabase
        .from('user_credentials')
        .update({
          google_access_token: newTokens.access_token,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (updateError) {
        console.error('❌ Error actualizando token en BD:', updateError)
        throw new Error('No se pudo actualizar el token en la base de datos')
      }

      console.log('✅ Token renovado y actualizado en BD exitosamente')
      
      return {
        access_token: newTokens.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scope: newTokens.scope
      }

    } catch (error) {
      console.error('❌ Error en performTokenRefresh:', error)
      throw error
    }
  }

  /**
   * Renovar token para el usuario autenticado actual
   * @returns {Object} - Token válido
   */
  async refreshCurrentUserToken() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuario no autenticado')
      }

      return await this.getValidToken(user.id)
    } catch (error) {
      console.error('❌ Error renovando token del usuario actual:', error)
      throw error
    }
  }

  /**
   * Verificar y renovar token si es necesario (método de conveniencia)
   * @param {string} userId - ID del usuario (opcional, usa el usuario actual si no se proporciona)
   * @returns {string} - Token de acceso válido
   */
  async ensureValidToken(userId = null) {
    try {
      let targetUserId = userId
      
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('Usuario no autenticado')
        }
        targetUserId = user.id
      }

      const tokenData = await this.getValidToken(targetUserId)
      return tokenData.access_token
    } catch (error) {
      console.error('❌ Error asegurando token válido:', error)
      throw error
    }
  }

  /**
   * Limpiar tokens expirados y refresh tokens inválidos
   * @param {string} userId - ID del usuario
   */
  async cleanupInvalidTokens(userId) {
    try {
      const { error } = await supabase
        .from('user_credentials')
        .update({
          google_access_token: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Error limpiando tokens inválidos:', error)
      } else {
        console.log('🧹 Tokens inválidos limpiados para usuario:', userId)
      }
    } catch (error) {
      console.error('❌ Error en cleanupInvalidTokens:', error)
    }
  }
}

// Crear instancia singleton
const tokenRefreshService = new TokenRefreshService()

export default tokenRefreshService
export { TokenRefreshService }