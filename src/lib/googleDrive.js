import { supabase, auth, db } from './supabase'
import tokenRefreshService from '../services/tokenRefreshService'
import googleDriveMiddleware from './googleDriveMiddleware'

// Google Drive API service for browser environment
class GoogleDriveService {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.isInitialized = false
    this.currentUserId = null
  }

  async initialize() {
    try {
      // Load Google API script if not already loaded
      if (!window.gapi) {
        await this.loadGoogleAPI()
      }
      
      await new Promise((resolve) => {
        window.gapi.load('auth2', resolve)
      })
      
      this.initialized = true
      return true
    } catch (error) {
      console.error('Error initializing Google Drive:', error)
      return false
    }
  }

  loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve()
        return
      }
      
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  generateAuthUrl() {
    const params = new URLSearchParams({
      client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      redirect_uri: process.env.REACT_APP_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/google/callback`,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    })
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async exchangeCodeForTokens(code) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.REACT_APP_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/google/callback`
        })
      })
      
      if (!response.ok) {
        const errorData = await response.text()
        console.error('Google token exchange failed:', response.status, errorData)
        
        // Manejo específico de errores comunes
        if (response.status === 403) {
          throw new Error('Límite de solicitudes excedido. Por favor, intenta nuevamente en unos minutos.')
        } else if (response.status === 400) {
          throw new Error('Código de autorización inválido o expirado. Por favor, intenta conectar Google Drive nuevamente.')
        } else if (response.status === 401) {
          throw new Error('Credenciales de Google inválidas. Verifica la configuración del proyecto.')
        } else {
          throw new Error(`Error de conexión con Google (${response.status}). Intenta nuevamente.`)
        }
      }
      
      const tokens = await response.json()
      
      if (!tokens || typeof tokens !== 'object') {
        console.error('Invalid tokens response:', tokens)
        throw new Error('Invalid tokens response from Google')
      }
      
      if (tokens.error) {
        console.error('Google API error:', tokens.error, tokens.error_description)
        throw new Error(`Google API error: ${tokens.error}`)
      }
      
      if (tokens.access_token) {
        this.accessToken = tokens.access_token
      }
      
      return tokens
    } catch (error) {
      console.error('Error getting tokens:', error)
      throw error
    }
  }

  // Configurar tokens existentes - Ahora usa el sistema de renovación automática
  async setTokens(tokens) {
    try {
      // Obtener usuario actual usando la instancia importada de supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        this.currentUserId = user.id
      }

      // Si tenemos un access_token directamente, usarlo
      if (tokens.access_token) {
        this.accessToken = tokens.access_token
        this.refreshToken = tokens.refresh_token
        return true
      }
      
      // Si tenemos un refresh_token, obtener un token válido usando el servicio
      if (tokens.refresh_token) {
        this.refreshToken = tokens.refresh_token
        
        // Usar el servicio de renovación para obtener un token válido
        const validTokenData = await tokenRefreshService.getValidToken(this.currentUserId)
        this.accessToken = validTokenData.access_token
        
        return {
          access_token: validTokenData.access_token,
          refresh_token: validTokenData.refresh_token,
          expires_at: validTokenData.expires_at
        }
      }
      
      throw new Error('No valid tokens provided')
    } catch (error) {
      console.error('Error setting tokens:', error)
      return false
    }
  }

  // Método separado para renovar access token
  async refreshAccessToken(refreshToken) {
    try {
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
        console.error('Error refreshing Google token:', response.status, errorData)
        throw new Error(`Error refreshing token: ${response.status}`)
      }
      
      const refreshedTokens = await response.json()
      return refreshedTokens
    } catch (error) {
      console.error('Error in refreshAccessToken:', error)
      throw error
    }
  }

  // Crear carpeta
  async createFolder(name, parentId = null) {
    try {
      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      }

      if (parentId) {
        fileMetadata.parents = [parentId]
      }

      return await googleDriveMiddleware.post(
        'https://www.googleapis.com/drive/v3/files?fields=id,name,parents',
        fileMetadata,
        { 'Content-Type': 'application/json' },
        this.currentUserId
      )
    } catch (error) {
      console.error('Error creating folder:', error)
      throw error
    }
  }

  // Listar archivos y carpetas - Ahora usa el middleware con renovación automática
  async listFiles(parentId = null, pageSize = 100) {
    try {
      let targetParentId = parentId
      if (!targetParentId) {
        targetParentId = await this.ensureAppFolder()
      }

      let query = `trashed=false and mimeType!='application/vnd.google-apps.shortcut'`
      if (targetParentId) {
        query += ` and '${targetParentId}' in parents`
      }

      const params = new URLSearchParams({
        q: query,
        pageSize: pageSize.toString(),
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,shared)'
      })

      const data = await googleDriveMiddleware.get(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        this.currentUserId
      )

      if (!data || !Array.isArray(data.files)) {
        console.warn('Google Drive API response does not contain files array:', data)
        return []
      }

      return data.files
    } catch (error) {
      console.error('Error listing files:', error)
      throw error
    }
  }
  
  async ensureAppFolder() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const existing = await db.adminFolders.getByUser(user.id)
      const existingFolderId = existing?.data?.[0]?.id_drive_carpeta
      if (existingFolderId) {
        return existingFolderId
      }

      const appFolder = await this.createFolder('Master - Brify')
      const newFolderId = appFolder?.id

      if (newFolderId) {
        await db.adminFolders.create({
          user_id: user.id,
          correo: user.email,
          id_drive_carpeta: newFolderId
        })
      }

      return newFolderId
    } catch (error) {
      console.error('Error ensuring app folder:', error)
      return null
    }
  }
  // Manejar renovación automática de tokens - Ahora delegado al tokenRefreshService
  async handleTokenRefresh() {
    try {
      console.log('🔄 Usando servicio de renovación de tokens...')
      const tokenData = await tokenRefreshService.refreshCurrentUserToken()
      this.accessToken = tokenData.access_token
      this.refreshToken = tokenData.refresh_token
      console.log('✅ Token renovado exitosamente')
      return true
    } catch (error) {
      console.error('❌ Error renovando token:', error)
      throw error
    }
  }

  // Subir archivo
  async uploadFile(file, parentId = null) {
    try {
      const fileMetadata = {
        name: file.name
      }

      if (parentId) {
        fileMetadata.parents = [parentId]
      }

      const formData = new FormData()
      formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }))
      formData.append('file', file)

      const result = await googleDriveMiddleware.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType',
        formData,
        {},
        this.currentUserId
      )
      
      console.log('✅ Google Drive upload result:', result)
      return result.id // Retornar solo el ID del archivo
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  }

  // Eliminar archivo o carpeta
  async deleteFile(fileId) {
    // Validar que fileId sea una cadena válida
    if (!fileId || typeof fileId !== 'string') {
      throw new Error(`ID de archivo inválido: ${fileId}`)
    }

    try {
      console.log('🗑️ Eliminando archivo de Google Drive con ID:', fileId)
      
      await googleDriveMiddleware.delete(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {},
        this.currentUserId
      )
      
      console.log('✅ Archivo eliminado exitosamente de Google Drive')
      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  }

  // Compartir carpeta con email
  async shareFolder(folderId, email, role = 'reader') {
    try {
      const permission = {
        type: 'user',
        role: role,
        emailAddress: email
      }

      return await googleDriveMiddleware.post(
        `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=true`,
        permission,
        { 'Content-Type': 'application/json' },
        this.currentUserId
      )
    } catch (error) {
      console.error('Error sharing folder:', error)
      throw error
    }
  }

  // Obtener permisos de una carpeta
  async getFolderPermissions(folderId) {
    try {
      const data = await googleDriveMiddleware.get(
        `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,type,role,emailAddress,displayName)`,
        this.currentUserId
      )
      
      // Devolver TODOS los permisos para que isFolderShared pueda determinar correctamente si está compartida
      // Una carpeta está compartida si tiene más de 1 permiso (propietario + otros usuarios)
      const allPermissions = data.permissions || []
      
      console.log(`🔍 Debug getFolderPermissions - Carpeta ${folderId}:`, {
        totalPermissions: allPermissions.length,
        permissions: allPermissions.map(p => ({
          type: p.type,
          role: p.role,
          email: p.emailAddress,
          displayName: p.displayName
        }))
      })

      return allPermissions
    } catch (error) {
      console.error('Error getting folder permissions:', error)
      return []
    }
  }

  // Obtener información de archivo
  async getFileInfo(fileId) {
    try {
      const params = new URLSearchParams({
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents'
      })

      return await googleDriveMiddleware.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,
        this.currentUserId
      )
    } catch (error) {
      console.error('Error getting file info:', error)
      throw error
    }
  }

  // Descargar archivo
  async downloadFile(fileId) {
    try {
      // Usar el middleware para obtener el blob directamente
      const blob = await googleDriveMiddleware.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        this.currentUserId,
        true // returnBlob = true para descargas
      )

      return blob
    } catch (error) {
      console.error('Error downloading file:', error)
      throw error
    }
  }
}

// Instancia singleton
const googleDriveService = new GoogleDriveService()

export default googleDriveService
export { GoogleDriveService }

