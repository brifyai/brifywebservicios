import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funciones de autenticación
export const auth = {
  // Registro de usuario
  signUp: async (email, password, userData = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { data, error }
  },

  // Inicio de sesión
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Cerrar sesión
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Obtener usuario actual
  getCurrentUser: () => {
    return supabase.auth.getUser()
  },

  // Obtener sesión actual
  getSession: () => {
    return supabase.auth.getSession()
  },

  // Escuchar cambios de autenticación
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Función auxiliar para reintentos con backoff exponencial simple
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      return result
    } catch (error) {
      console.warn(`Intento ${attempt}/${maxRetries} falló:`, error.message)
      
      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        throw error
      }
      
      // Esperar antes del siguiente intento (backoff exponencial)
      const delay = baseDelay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Función auxiliar para manejar errores de red
const handleNetworkError = (error, operation) => {
  console.error(`❌ Error en ${operation}:`, error)
  
  if (error.message?.includes('ERR_INSUFFICIENT_RESOURCES') || 
      error.message?.includes('Failed to fetch') ||
      error.code === 'NETWORK_ERROR') {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: `Error de conexión en ${operation}. Reintentando...`,
        originalError: error
      }
    }
  }
  
  return { data: null, error }
}

// Funciones de base de datos
export const db = {
  // Usuarios
  users: {
    create: async (userData) => {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
      return { data, error }
    },
    
    upsert: async (userData) => {
      const { data, error } = await supabase
        .from('users')
        .upsert([userData], { onConflict: 'id' })
        .select()
      return { data, error }
    },
    
    getById: async (id) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        
        if (error) {
          console.error('Error fetching user by ID:', error)
          return { data: null, error }
        }
        
        return { data, error: null }
      } catch (fetchError) {
        console.error('Network error fetching user:', fetchError)
        return { data: null, error: { code: 'NETWORK_ERROR', message: 'Failed to fetch user data' } }
      }
    },
    
    getByTelegramId: async (telegramId) => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single()
      return { data, error }
    },
    
    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
      return { data, error }
    }
  },

  // Planes
  plans: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price_usd', { ascending: true })
      return { data, error }
    },
    
    getById: async (id) => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', id)
        .single()
      return { data, error }
    }
  },

  // Pagos
  payments: {
    create: async (paymentData) => {
      const { data, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select()
      return { data, error }
    },
    
    getByUserId: async (userId) => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, plans(*)')
        .eq('user_id', userId)
        .order('paid_at', { ascending: false })
      return { data, error }
    }
  },

  // Carpetas de usuario
  userFolders: {
    create: async (folderData) => {
      const { data, error } = await supabase
        .from('carpetas_usuario')
        .insert([folderData])
        .select()
      return { data, error }
    },
    
    getByTelegramId: async (telegramId) => {
      const { data, error } = await supabase
        .from('carpetas_usuario')
        .select('*')
        .eq('telegram_id', telegramId)
      return { data, error }
    },
    
    getByAdministrador: async (adminEmail) => {
      try {
        return await retryWithBackoff(async () => {
          const { data, error } = await supabase
            .from('carpetas_usuario')
            .select('*')
            .eq('administrador', adminEmail)
          
          if (error) throw error
          return { data, error: null }
        })
      } catch (error) {
        return handleNetworkError(error, 'getByAdministrador')
      }
    },
    
    getByUser: async (userId) => {
      // Obtener el usuario autenticado directamente
      const { data: currentUser } = await auth.getCurrentUser()
      if (!currentUser?.user) {
        console.log('No authenticated user found')
        return { data: [], error: null }
      }
      
      console.log('Current user for folder search:', currentUser.user)
      
      // Buscar directamente por el email del usuario autenticado como administrador
      console.log('Searching by administrador:', currentUser.user.email)
      const result = await supabase
        .from('carpetas_usuario')
        .select('*')
        .eq('administrador', currentUser.user.email)
      
      const data = result.data || []
      console.log('Results by administrador:', data)
      console.log('Final folder data:', data)
      
      return { data, error: result.error }
    },
    
    getByParent: async (parentId) => {
      // Para carpetas de usuario, no hay jerarquía de parent, todas están bajo la carpeta admin
      // Esta función retorna un array vacío ya que las carpetas de usuario son planas
      return { data: [], error: null }
    }
  },

  // Carpetas de administrador
  adminFolders: {
    create: async (folderData) => {
      const { data, error } = await supabase
        .from('carpeta_administrador')
        .insert([folderData])
        .select()
      return { data, error }
    },
    
    getByEmail: async (email) => {
      try {
        return await retryWithBackoff(async () => {
          const { data, error } = await supabase
            .from('carpeta_administrador')
            .select('*')
            .eq('correo', email)
          
          if (error) throw error
          return { data, error: null }
        })
      } catch (error) {
        return handleNetworkError(error, 'adminFolders.getByEmail')
      }
    },
    
    getByTelegramId: async (telegramId) => {
      const { data, error } = await supabase
        .from('carpeta_administrador')
        .select('*')
        .eq('telegram_id', telegramId)
      return { data, error }
    },
    
    getByUser: async (userId) => {
      try {
        return await retryWithBackoff(async () => {
          // Para obtener carpetas admin por usuario, necesitamos usar el email del usuario
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()
          
          if (userError) throw userError
          
          const { data, error } = await supabase
            .from('carpeta_administrador')
            .select('*')
            .eq('correo', userData.email)
          
          if (error) throw error
          return { data, error: null }
        })
      } catch (error) {
        return handleNetworkError(error, 'adminFolders.getByUser')
      }
    }
  },

  // Subcarpetas de administrador (extensiones)
  subCarpetasAdministrador: {
    create: async (subcarpetaData) => {
      const { data, error } = await supabase
        .from('sub_carpetas_administrador')
        .insert([subcarpetaData])
        .select()
      return { data, error }
    },
    
    getByEmail: async (email) => {
      const { data, error } = await supabase
        .from('sub_carpetas_administrador')
        .select('*')
        .eq('administrador_email', email)
      return { data, error }
    },
    
    getByMasterFolderId: async (masterFolderId) => {
      const { data, error } = await supabase
        .from('sub_carpetas_administrador')
        .select('*')
        .eq('file_id_master', masterFolderId)
      return { data, error }
    },
    
    getByTipoExtension: async (email, tipoExtension) => {
      const { data, error } = await supabase
        .from('sub_carpetas_administrador')
        .select('*')
        .eq('administrador_email', email)
        .eq('tipo_extension', tipoExtension)
        .single()
      return { data, error }
    },
    
    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('sub_carpetas_administrador')
        .update(updates)
        .eq('id', id)
        .select()
      return { data, error }
    },
    
    delete: async (id) => {
      const { data, error } = await supabase
        .from('sub_carpetas_administrador')
        .delete()
        .eq('id', id)
      return { data, error }
    }
  },

  // Credenciales de usuario para Google Drive
  userCredentials: {
    create: async (credentialsData) => {
      const { data, error } = await supabase
        .from('user_credentials')
        .insert([credentialsData])
        .select()
      return { data, error }
    },
    
    upsert: async (credentialsData) => {
      // Usar upsert nativo de Supabase que maneja INSERT/UPDATE automáticamente
      const { data, error } = await supabase
        .from('user_credentials')
        .upsert([credentialsData], {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()
      return { data, error }
    },
    
    getByUserId: async (userId) => {
      const { data, error } = await supabase
        .from('user_credentials')
        .select('*')
        .eq('user_id', userId)
        .single()
      return { data, error }
    },
    
    getByTelegramId: async (telegramId) => {
      const { data, error } = await supabase
        .from('user_credentials')
        .select('*')
        .eq('telegram_chat_id', telegramId)
        .single()
      return { data, error }
    },
    
    update: async (userId, updates) => {
      const { data, error } = await supabase
        .from('user_credentials')
        .update(updates)
        .eq('user_id', userId)
        .select()
      return { data, error }
    },
    
    updateByTelegramId: async (telegramId, updates) => {
      const { data, error } = await supabase
        .from('user_credentials')
        .update(updates)
        .eq('telegram_chat_id', telegramId)
        .select()
      return { data, error }
    }
  },

  // Uso de tokens de usuario
  userTokensUsage: {
    create: async (tokenData) => {
      const { data, error } = await supabase
        .from('user_tokens_usage')
        .insert([tokenData])
        .select()
      return { data, error }
    },
    
    upsert: async (tokenData) => {
      const { data, error } = await supabase
        .from('user_tokens_usage')
        .upsert([tokenData], { 
          onConflict: 'user_id',
          returning: 'minimal' 
        })
      return { data, error }
    },
    
    getByUserId: async (userId) => {
      const { data, error } = await supabase
        .from('user_tokens_usage')
        .select('*')
        .eq('user_id', userId)
        .single()
      return { data, error }
    },
    
    update: async (userId, updates) => {
      const { data, error } = await supabase
        .from('user_tokens_usage')
        .update(updates)
        .eq('user_id', userId)
        .select()
      return { data, error }
    }
  },

  // Documentos del entrenador
  trainerDocuments: {
    create: async (documentData) => {
      const { data, error } = await supabase
        .from('documentos_entrenador')
        .insert([documentData])
        .select()
      return { data, error }
    },
    
    getByUser: async (userId) => {
      // Obtener el email del usuario para buscar por entrenador
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
      
      if (userError) return { data: null, error: userError }
      
      const { data, error } = await supabase
        .from('documentos_entrenador')
        .select('*')
        .eq('entrenador', userData.email)
        .order('created_at', { ascending: false }) // Comentado hasta que se agregue la columna created_at
      return { data, error }
    },
    
    getByFolder: async (folderId) => {
      const { data, error } = await supabase
        .from('documentos_entrenador')
        .select('*')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false })
      return { data, error }
    },
    
    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('documentos_entrenador')
        .update(updates)
        .eq('id', id)
        .select()
      return { data, error }
    },
    
    delete: async (id) => {
      const { data, error } = await supabase
        .from('documentos_entrenador')
        .delete()
        .eq('id', id)
      return { data, error }
    }
  },

  // Documentos de usuario para entrenador (archivos subidos)
  userTrainerDocuments: {
    create: async (documentData) => {
      const { data, error } = await supabase
        .from('documentos_usuario_entrenador')
        .insert([documentData])
        .select()
      return { data, error }
    },
    
    getByUser: async (userId) => {
      // Obtener el telegram_id del usuario
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('telegram_id')
        .eq('id', userId)
        .single()
      
      if (userError) return { data: null, error: userError }
      
      const { data, error } = await supabase
        .from('documentos_usuario_entrenador')
        .select('*')
        .eq('telegram_id', userData.telegram_id)
        .order('created_at', { ascending: false })
      return { data, error }
    },
    
    getByTelegramId: async (telegramId) => {
      const { data, error } = await supabase
        .from('documentos_usuario_entrenador')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('created_at', { ascending: false })
      return { data, error }
    },
    
    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('documentos_usuario_entrenador')
        .update(updates)
        .eq('id', id)
        .select()
      return { data, error }
    },
    
    delete: async (id) => {
      const { data, error } = await supabase
        .from('documentos_usuario_entrenador')
        .delete()
        .eq('id', id)
      return { data, error }
    },
    
    deleteByFileId: async (fileId) => {
      const { data, error } = await supabase
        .from('documentos_usuario_entrenador')
        .delete()
        .eq('file_id', fileId)
      return { data, error }
    }
  }
}