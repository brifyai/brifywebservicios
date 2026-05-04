/**
 * Servicio para la renovación automática de tokens de Google Drive
 * Maneja la expiración y renovación proactiva de tokens de acceso
 */

import { supabase } from '../lib/supabase'

class TokenRefreshService {
  constructor() {
    this.refreshInProgress = new Map() // Para evitar múltiples renovaciones simultáneas
    this.tokenExpirationBuffer = 5 * 60 * 1000 // 5 minutos antes de la expiración
    this.autoRefreshInterval = null // Intervalo para renovación automática
    this.isAutoRefreshEnabled = false
  }

  /**
   * Inicializar el servicio de renovación automática
   */
  async initializeAutoRefresh() {
    if (this.isAutoRefreshEnabled) return

    try {
      console.log('🔄 Inicializando servicio de renovación automática de tokens...')
      
      // Verificar cada 30 minutos si hay tokens que necesiten renovación
      this.autoRefreshInterval = setInterval(async () => {
        await this.checkAndRefreshExpiredTokens()
      }, 30 * 60 * 1000) // 30 minutos

      this.isAutoRefreshEnabled = true
      console.log('✅ Servicio de renovación automática iniciado')
      
      // Ejecutar una verificación inicial
      await this.checkAndRefreshExpiredTokens()
    } catch (error) {
      console.error('❌ Error inicializando renovación automática:', error)
    }
  }

  /**
   * Detener el servicio de renovación automática
   */
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval)
      this.autoRefreshInterval = null
      this.isAutoRefreshEnabled = false
      console.log('🛑 Servicio de renovación automática detenido')
    }
  }

  /**
   * Verificar y renovar tokens expirados de todos los usuarios
   */
  async checkAndRefreshExpiredTokens() {
    try {
      console.log('🔍 Verificando tokens expirados...')
      
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar si el token del usuario actual necesita renovación
      await this.ensureValidToken(user.id)
    } catch (error) {
      console.error('❌ Error verificando tokens expirados:', error)
    }
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
        
        // Manejar errores específicos
        if (response.status === 400 && errorData.includes('invalid_grant')) {
          throw new Error('REFRESH_TOKEN_INVALID')
        }
        
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
   * Calcular fecha de expiración basada en expires_in
   * @param {number} expiresIn - Segundos hasta la expiración
   * @returns {Date} - Fecha de expiración
   */
  calculateExpirationDate(expiresIn) {
    return new Date(Date.now() + (expiresIn * 1000))
  }

  /**
   * Verificar si un token necesita renovación
   * @param {Date} expirationDate - Fecha de expiración del token
   * @returns {boolean} - True si necesita renovación
   */
  needsRefresh(expirationDate) {
    if (!expirationDate) return true
    return (new Date(expirationDate).getTime() - Date.now()) <= this.tokenExpirationBuffer
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

      // Si no hay access_token o necesita renovación, renovar
      if (!credentials.google_access_token) {
        console.log('🔄 No hay access_token, renovando...')
        const refreshPromise = this.performTokenRefresh(userId, credentials.google_refresh_token)
        this.refreshInProgress.set(userId, refreshPromise)

        try {
          const result = await refreshPromise
          return result
        } finally {
          this.refreshInProgress.delete(userId)
        }
      }

      // Verificar si el token actual es válido haciendo una llamada de prueba
      const isValid = await this.validateToken(credentials.google_access_token)
      
      if (!isValid) {
        console.log('🔄 Token inválido, renovando...')
        const refreshPromise = this.performTokenRefresh(userId, credentials.google_refresh_token)
        this.refreshInProgress.set(userId, refreshPromise)

        try {
          const result = await refreshPromise
          return result
        } finally {
          this.refreshInProgress.delete(userId)
        }
      }

      console.log('✅ Token válido disponible')
      return {
        access_token: credentials.google_access_token,
        refresh_token: credentials.google_refresh_token,
        expires_at: null // No tenemos fecha de expiración almacenada
      }

    } catch (error) {
      console.error('❌ Error en getValidToken:', error)
      this.refreshInProgress.delete(userId)
      throw error
    }
  }

  /**
   * Validar un token haciendo una llamada de prueba a la API de Google
   * @param {string} accessToken - Token de acceso a validar
   * @returns {boolean} - True si el token es válido
   */
  async validateToken(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + accessToken)
      return response.ok
    } catch (error) {
      console.error('❌ Error validando token:', error)
      return false
    }
  }

  /**
   * Realizar renovación de token y actualizar en base de datos
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
      
      // Si el refresh_token es inválido, limpiar credenciales
      if (error.message === 'REFRESH_TOKEN_INVALID') {
        await this.cleanupInvalidTokens(userId)
        throw new Error('El refresh_token ha expirado. Es necesario reconectar Google Drive.')
      }
      
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
          google_refresh_token: null,
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

  /**
   * Método para uso en N8N - renovar token específico
   * @param {string} refreshToken - Refresh token
   * @returns {Object} - Nuevo access token
   */
  async refreshTokenForN8N(refreshToken) {
    try {
      console.log('🔄 Renovando token para N8N...')
      
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
        console.error('❌ Error renovando token para N8N:', response.status, errorData)
        throw new Error(`Error renovando token: ${response.status}`)
      }
      
      const tokens = await response.json()
      console.log('✅ Token renovado exitosamente para N8N')
      
      return {
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type
      }
    } catch (error) {
      console.error('❌ Error en refreshTokenForN8N:', error)
      throw error
    }
  }
}

// Crear instancia singleton
const tokenRefreshService = new TokenRefreshService()

export default tokenRefreshService
export { TokenRefreshService }