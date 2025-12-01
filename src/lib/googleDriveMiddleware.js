/**
 * Middleware para Google Drive API que maneja automáticamente la renovación de tokens
 * Intercepta las llamadas y renueva tokens expirados de forma transparente
 */

import { supabase } from './supabase'
import tokenRefreshService from '../services/tokenRefreshService'

class GoogleDriveMiddleware {
  constructor() {
    this.maxRetries = 2 // Máximo número de reintentos por llamada
  }

  /**
   * Ejecutar una llamada a la API de Google Drive con renovación automática de tokens
   * @param {Function} apiCall - Función que realiza la llamada a la API
   * @param {string} userId - ID del usuario (opcional)
   * @param {number} retryCount - Contador de reintentos
   * @returns {*} - Resultado de la llamada a la API
   */
  async executeWithTokenRefresh(apiCall, userId = null, retryCount = 0) {
    try {
      // Asegurar que tenemos un token válido antes de la llamada
      const validToken = await tokenRefreshService.ensureValidToken(userId)
      
      // Ejecutar la llamada a la API
      const result = await apiCall(validToken)
      return result

    } catch (error) {
      // Verificar si es un error de autenticación/autorización
      if (this.isAuthError(error) && retryCount < this.maxRetries) {
        console.log(`🔄 Error de autenticación detectado, reintentando... (${retryCount + 1}/${this.maxRetries})`)
        
        try {
          // Forzar renovación del token
          let targetUserId = userId
          if (!targetUserId) {
            const { data: { user } } = await supabase.auth.getUser()
            targetUserId = user?.id
          }
          
          if (targetUserId) {
            await tokenRefreshService.getValidToken(targetUserId)
            // Reintentar la llamada
            return await this.executeWithTokenRefresh(apiCall, userId, retryCount + 1)
          }
        } catch (refreshError) {
          console.error('❌ Error renovando token en middleware:', refreshError)
          throw new Error('No se pudo renovar el token de Google Drive. Reconecta tu cuenta.')
        }
      }
      
      // Si no es un error de auth o ya agotamos los reintentos, propagar el error
      throw error
    }
  }

  /**
   * Verificar si un error es relacionado con autenticación/autorización
   * @param {Error} error - Error a verificar
   * @returns {boolean} - True si es un error de autenticación
   */
  isAuthError(error) {
    if (!error) return false
    
    const errorMessage = error.message?.toLowerCase() || ''
    const errorStatus = error.status || error.response?.status
    
    // Códigos de estado HTTP relacionados con autenticación
    const authStatusCodes = [401, 403]
    
    // Mensajes de error comunes de Google API
    const authErrorMessages = [
      'invalid_token',
      'token_expired',
      'unauthorized',
      'invalid credentials',
      'authentication failed',
      'access denied',
      'invalid_grant'
    ]
    
    return (
      authStatusCodes.includes(errorStatus) ||
      authErrorMessages.some(msg => errorMessage.includes(msg))
    )
  }

  /**
   * Wrapper para llamadas GET a Google Drive API
   * @param {string} url - URL de la API
   * @param {string} userId - ID del usuario
   * @param {boolean} returnBlob - Si true, retorna blob en lugar de JSON
   * @param {Object} options - Opciones adicionales
   * @returns {*} - Respuesta de la API
   */
  async get(url, userId = null, returnBlob = false, options = {}) {
    return await this.executeWithTokenRefresh(async (token) => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(returnBlob ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers
        },
        ...options
      })

      if (!response.ok) {
        const errorData = await response.text()
        const error = new Error(`API Error: ${response.status} - ${errorData}`)
        error.status = response.status
        throw error
      }

      return returnBlob ? await response.blob() : await response.json()
    }, userId)
  }

  /**
   * Wrapper para llamadas POST a Google Drive API
   * @param {string} url - URL de la API
   * @param {*} body - Cuerpo de la petición
   * @param {Object} options - Opciones adicionales
   * @param {string} userId - ID del usuario
   * @returns {*} - Respuesta de la API
   */
  async post(url, body = null, options = {}, userId = null) {
    return await this.executeWithTokenRefresh(async (token) => {
      const requestOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...options.headers
        },
        ...options
      }

      // Solo agregar Content-Type y body si no es FormData
      if (body && !(body instanceof FormData)) {
        requestOptions.headers['Content-Type'] = 'application/json'
        requestOptions.body = JSON.stringify(body)
      } else if (body instanceof FormData) {
        requestOptions.body = body
      }

      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const errorData = await response.text()
        const error = new Error(`API Error: ${response.status} - ${errorData}`)
        error.status = response.status
        throw error
      }

      return await response.json()
    }, userId)
  }

  /**
   * Wrapper para llamadas DELETE a Google Drive API
   * @param {string} url - URL de la API
   * @param {Object} options - Opciones adicionales
   * @param {string} userId - ID del usuario
   * @returns {*} - Respuesta de la API
   */
  async delete(url, options = {}, userId = null) {
    return await this.executeWithTokenRefresh(async (token) => {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...options.headers
        },
        ...options
      })

      if (!response.ok) {
        const errorData = await response.text()
        const error = new Error(`API Error: ${response.status} - ${errorData}`)
        error.status = response.status
        throw error
      }

      // DELETE puede no devolver contenido
      if (response.status === 204) {
        return { success: true }
      }

      return await response.json()
    }, userId)
  }

  /**
   * Wrapper para llamadas PATCH a Google Drive API
   * @param {string} url - URL de la API
   * @param {*} body - Cuerpo de la petición
   * @param {Object} options - Opciones adicionales
   * @param {string} userId - ID del usuario
   * @returns {*} - Respuesta de la API
   */
  async patch(url, body = null, options = {}, userId = null) {
    return await this.executeWithTokenRefresh(async (token) => {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: body ? JSON.stringify(body) : null,
        ...options
      })

      if (!response.ok) {
        const errorData = await response.text()
        const error = new Error(`API Error: ${response.status} - ${errorData}`)
        error.status = response.status
        throw error
      }

      return await response.json()
    }, userId)
  }

  /**
   * Método de conveniencia para verificar el estado del token
   * @param {string} userId - ID del usuario
   * @returns {Object} - Estado del token
   */
  async checkTokenStatus(userId = null) {
    try {
      const tokenData = await tokenRefreshService.getValidToken(userId)
      return {
        valid: true,
        expires_at: tokenData.expires_at,
        needs_refresh: tokenRefreshService.needsRefresh(tokenData.expires_at)
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      }
    }
  }
}

// Crear instancia singleton
const googleDriveMiddleware = new GoogleDriveMiddleware()

export default googleDriveMiddleware
export { GoogleDriveMiddleware }