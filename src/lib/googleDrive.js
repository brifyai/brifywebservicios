// Google Drive API service for browser environment
class GoogleDriveService {
  constructor() {
    this.accessToken = null
    this.initialized = false
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
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send',
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

  // Configurar tokens existentes
  async setTokens(tokens) {
    try {
      // Si tenemos un access_token directamente, usarlo
      if (tokens.access_token) {
        this.accessToken = tokens.access_token
        return true
      }
      
      // Si tenemos un refresh_token, usarlo para obtener un access_token
      if (tokens.refresh_token) {
        const refreshedTokens = await this.refreshAccessToken(tokens.refresh_token)
        
        if (refreshedTokens.access_token) {
          this.accessToken = refreshedTokens.access_token
          return refreshedTokens
        } else {
          throw new Error('No access token received from refresh')
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
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

    try {
      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      }

      if (parentId) {
        fileMetadata.parents = [parentId]
      }

      const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,parents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fileMetadata)
      })

      return await response.json()
    } catch (error) {
      console.error('Error creating folder:', error)
      throw error
    }
  }

  // Listar archivos y carpetas
  async listFiles(parentId = null, pageSize = 100) {
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

    try {
      let query = "trashed=false"
      if (parentId) {
        query += ` and '${parentId}' in parents`
      }

      const params = new URLSearchParams({
        q: query,
        pageSize: pageSize,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents)'
      })

      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google Drive API error:', response.status, errorText)
        
        // Si es error 401, intentar renovar el token
        if (response.status === 401) {
          console.log('Token expirado, intentando renovar...')
          await this.handleTokenRefresh()
          
          // Reintentar la petición con el nuevo token
          const retryResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            }
          })
          
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text()
            console.error('Google Drive API error after token refresh:', retryResponse.status, retryErrorText)
            throw new Error(`Error de Google Drive API: ${retryResponse.status}`)
          }
          
          const retryData = await retryResponse.json()
          
          if (!retryData || !Array.isArray(retryData.files)) {
            console.warn('Google Drive API response does not contain files array:', retryData)
            return []
          }
          
          return retryData.files
        }
        
        throw new Error(`Error de Google Drive API: ${response.status}`)
      }

      const data = await response.json()
      
      // Verificar que la respuesta contenga files y sea un array
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

  // Manejar renovación automática de tokens
  async handleTokenRefresh() {
    try {
      // Obtener el refresh token desde la base de datos
      const { data: { user } } = await window.supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuario no autenticado')
      }

      const { data: credentials } = await window.supabase
        .from('user_credentials')
        .select('google_refresh_token')
        .eq('user_id', user.id)
        .single()

      if (!credentials || !credentials.google_refresh_token) {
        throw new Error('No se encontró refresh token')
      }

      const refreshedTokens = await this.refreshAccessToken(credentials.google_refresh_token)
      
      if (refreshedTokens.access_token) {
        this.accessToken = refreshedTokens.access_token
        
        // Actualizar el token en la base de datos
        await window.supabase
          .from('user_credentials')
          .update({ 
            google_access_token: refreshedTokens.access_token,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
        
        console.log('Token renovado exitosamente')
        return true
      }
      
      throw new Error('No se pudo renovar el token')
    } catch (error) {
      console.error('Error renovando token:', error)
      throw error
    }
  }

  // Subir archivo
  async uploadFile(file, parentId = null) {
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

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

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: formData
      })

      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || `Error uploading file: ${response.status}`)
      }
      
      console.log('✅ Google Drive upload result:', result)
      return result.id // Retornar solo el ID del archivo
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  }

  // Eliminar archivo o carpeta
  async deleteFile(fileId) {
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

    // Validar que fileId sea una cadena válida
    if (!fileId || typeof fileId !== 'string') {
      throw new Error(`ID de archivo inválido: ${fileId}`)
    }

    try {
      console.log('🗑️ Eliminando archivo de Google Drive con ID:', fileId)
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })
      
      if (response.ok) {
        console.log('✅ Archivo eliminado exitosamente de Google Drive')
        return true
      } else {
        const errorText = await response.text()
        console.error('❌ Error en respuesta de Google Drive:', response.status, errorText)
        throw new Error(`Error ${response.status}: ${errorText}`)
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  }

  // Compartir carpeta con email
  async shareFolder(folderId, email, role = 'reader') {
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

    try {
      const permission = {
        type: 'user',
        role: role,
        emailAddress: email
      }

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(permission)
      })

      return await response.json()
    } catch (error) {
      console.error('Error sharing folder:', error)
      throw error
    }
  }

  // Obtener permisos de una carpeta
  async getFolderPermissions(folderId) {
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,type,role,emailAddress,displayName)`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Error obteniendo permisos: ${response.status}`)
      }

      const data = await response.json()
      
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
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

    try {
      const params = new URLSearchParams({
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents'
      })

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      return await response.json()
    } catch (error) {
      console.error('Error getting file info:', error)
      throw error
    }
  }

  // Descargar archivo
  async downloadFile(fileId) {
    if (!this.accessToken) {
      throw new Error('Google Drive no está inicializado')
    }

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google Drive download error:', response.status, errorText)
        
        // Si es error 401, intentar renovar el token
        if (response.status === 401) {
          console.log('Token expirado, intentando renovar...')
          await this.handleTokenRefresh()
          
          // Reintentar la descarga con el nuevo token
          const retryResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            }
          })
          
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text()
            throw new Error(`Error downloading file after token refresh: ${retryResponse.status} - ${retryErrorText}`)
          }
          
          return await retryResponse.blob()
        }
        
        throw new Error(`Error downloading file: ${response.status} - ${errorText}`)
      }

      return await response.blob()
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