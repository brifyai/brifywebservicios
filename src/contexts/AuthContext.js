import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { auth, db, supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const registrationProcessed = useRef(new Set())
  const profileLoadProcessed = useRef(new Set())

  // Cargar perfil del usuario desde la base de datos
  const loadUserProfile = async (userId, forceReload = false) => {
    try {
      // Prevenir ejecuciones múltiples solo si no es una recarga forzada y ya tenemos userProfile
      if (!forceReload && userProfile && profileLoadProcessed.current.has(userId)) {
        console.log('Carga de perfil ya procesada para este usuario, omitiendo...')
        return userProfile
      }
      profileLoadProcessed.current.add(userId)
      
      const { data, error } = await db.users.getById(userId)
      
      // Cargar también las credenciales de Google Drive
      let googleCredentials = null
      try {
        const { data: credData } = await db.userCredentials.getByUserId(userId)
        googleCredentials = credData
      } catch (credError) {
        console.log('No Google credentials found for user:', userId)
      }
      
      // Si el usuario no existe (data es null), crearlo
      if (!data && !error) {
        console.log('Usuario no encontrado en la tabla users, creando perfil...')
        
        const userProfileData = {
          id: userId,
          email: user?.email || '',
          name: user?.user_metadata?.name || 'Usuario',
          telegram_id: null,
          is_active: true,
          current_plan_id: null,
          plan_expiration: null,
          used_storage_bytes: 0,
          registered_via: 'web',
          admin: false,
          onboarding_status: 'pending',
          registro_previo: true
        }
        
        const { data: newUserData, error: createError } = await db.users.upsert(userProfileData)
        
        if (createError) {
          console.error('Error creating user profile:', createError)
          // Establecer perfil básico si falla la creación
          const basicProfile = {
            id: userId,
            name: 'Usuario',
            email: user?.email || '',
            current_plan_id: null,
            is_active: true,
            plan_expiration: null,
            tokens_used: 0
          }
          setUserProfile(basicProfile)
          return basicProfile
        }
        
        // Crear registro inicial en user_tokens_usage usando upsert
        const { error: tokenError } = await db.userTokensUsage.upsert({
          user_id: userId,
          total_tokens: 0,
          last_updated_at: new Date().toISOString()
        })
        
        if (tokenError) {
          console.error('Error creating initial token usage record:', tokenError)
        }
        
        setUserProfile(newUserData[0])
        return newUserData[0]
      }
      
      if (error) {
        console.error('Error loading user profile:', error)
        
        // Si es un error de red, mostrar mensaje específico
        if (error.code === 'NETWORK_ERROR' || error.message?.includes('Failed to fetch')) {
          console.log('Error de conectividad detectado, usando perfil básico temporal')
          const basicProfile = {
            id: userId,
            name: 'Usuario (Sin conexión)',
            email: user?.email || '',
            current_plan_id: null,
            is_active: false,
            plan_expiration: null,
            tokens_used: 0,
            offline: true
          }
          setUserProfile(basicProfile)
          return basicProfile
        }
        
        // Para otros errores, establecer perfil básico
        const basicProfile = {
          id: userId,
          name: 'Usuario',
          email: user?.email || '',
          current_plan_id: null,
          is_active: false,
          plan_expiration: null,
          tokens_used: 0
        }
        setUserProfile(basicProfile)
        return basicProfile
      }
      
      // Combinar datos del usuario con credenciales de Google Drive
      const profileWithCredentials = {
        ...data,
        google_refresh_token: googleCredentials?.google_refresh_token || null,
        google_access_token: googleCredentials?.google_access_token || null
      }
      
      setUserProfile(profileWithCredentials)
      return profileWithCredentials
    } catch (error) {
      console.error('Error loading user profile:', error)
      // En caso de error de conectividad, establecer un perfil básico
      const basicProfile = {
        id: userId,
        name: 'Usuario',
        email: user?.email || '',
        current_plan_id: null,
        is_active: true,
        plan_expiration: null,
        tokens_used: 0
      }
      setUserProfile(basicProfile)
      return basicProfile
    }
  }

  // Registro de usuario
  const signUp = async (email, password, userData = {}) => {
    try {
      setLoading(true)
      
      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await auth.signUp(email, password, userData)
      
      if (authError) {
        toast.error(authError.message)
        return { error: authError }
      }

      // Crear perfil de usuario en la tabla users
      if (authData.user) {
        // Prevenir ejecuciones múltiples del proceso de registro
        const userId = authData.user.id
        if (registrationProcessed.current.has(userId)) {
          console.log('Registro ya procesado para este usuario, omitiendo...')
          return { data: authData }
        }
        registrationProcessed.current.add(userId)
        const userProfileData = {
          id: authData.user.id,
          email: email,
          name: userData.name || '',
          telegram_id: userData.telegram_id || null,
          is_active: true,
          current_plan_id: null,
          plan_expiration: null,
          used_storage_bytes: 0,
          registered_via: 'web',
          admin: false,
          onboarding_status: 'pending',
          registro_previo: true
        }

        // Usar upsert para evitar duplicados en caso de re-ejecución
        const { error: profileError } = await db.users.upsert(userProfileData)
        
        if (profileError) {
          console.error('Error creating user profile:', profileError)
          toast.error('Error al crear el perfil de usuario')
          return { error: profileError }
        }

        // Crear registro inicial en user_tokens_usage usando upsert
        const { error: tokenError } = await db.userTokensUsage.upsert({
          user_id: authData.user.id,
          total_tokens: 0,
          last_updated_at: new Date().toISOString()
        })
        
        if (tokenError) {
          console.error('Error creating initial token usage record:', tokenError)
          // No retornamos error aquí porque no es crítico para el registro
        }
      }

      toast.success('Registro exitoso. Revisa tu email para confirmar tu cuenta.')
      return { data: authData }
    } catch (error) {
      console.error('Error in signUp:', error)
      toast.error('Error durante el registro')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // Inicio de sesión
  const signIn = async (email, password) => {
    try {
      setLoading(true)
      
      const { data, error } = await auth.signIn(email, password)
      
      if (error) {
        toast.error(error.message)
        return { error }
      }

      if (data.user) {
        // No llamar loadUserProfile aquí, el useEffect de onAuthStateChange se encargará
        toast.success('Inicio de sesión exitoso')
      }

      return { data }
    } catch (error) {
      console.error('Error in signIn:', error)
      toast.error('Error durante el inicio de sesión')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // Cerrar sesión
  const signOut = async () => {
    try {
      setLoading(true)
      
      const { error } = await auth.signOut()
      
      if (error) {
        toast.error(error.message)
        return { error }
      }

      setUser(null)
      setUserProfile(null)
      setIsAuthenticated(false)
      // Limpiar registros de procesamiento
      registrationProcessed.current.clear()
      profileLoadProcessed.current.clear()
      toast.success('Sesión cerrada exitosamente')
      
      return { error: null }
    } catch (error) {
      console.error('Error in signOut:', error)
      toast.error('Error al cerrar sesión')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // Actualizar perfil de usuario
  const updateUserProfile = async (updates) => {
    try {
      if (!user) return { error: 'No hay usuario autenticado' }
      
      const { data, error } = await db.users.update(user.id, updates)
      
      if (error) {
        toast.error('Error al actualizar el perfil')
        return { error }
      }

      // Recargar el perfil completo para incluir credenciales de Google Drive
      await loadUserProfile(user.id, true)
      toast.success('Perfil actualizado exitosamente')
      return { data }
    } catch (error) {
      console.error('Error updating user profile:', error)
      toast.error('Error al actualizar el perfil')
      return { error }
    }
  }

  // Verificar si el usuario tiene un plan activo
  const hasActivePlan = () => {
    if (!userProfile) return false
    
    if (!userProfile.is_active || !userProfile.plan_expiration) {
      return false
    }
    
    const expirationDate = new Date(userProfile.plan_expiration)
    const now = new Date()
    
    return expirationDate > now
  }

  // Obtener días restantes del plan
  const getDaysRemaining = () => {
    if (!userProfile || !userProfile.plan_expiration) return 0
    
    const expirationDate = new Date(userProfile.plan_expiration)
    const now = new Date()
    const diffTime = expirationDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  }

  // Efecto para verificar sesión inicial
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          setIsAuthenticated(true)
          
          // Cargar perfil inmediatamente
          try {
            await loadUserProfile(session.user.id)
          } catch (error) {
            console.error('Error loading profile in initialization:', error)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }
    
    initializeAuth()
  }, [])

  // Efecto para manejar cambios de autenticación
  useEffect(() => {
    let profileLoadTimeout = null
    
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext: Auth state change event:', event, 'session exists:', !!session)
      
      // Para INITIAL_SESSION, solo procesar si no tenemos userProfile
      if (event === 'INITIAL_SESSION' && userProfile) {
        console.log('AuthContext: INITIAL_SESSION with existing userProfile, skipping')
        return
      }
      
      setLoading(true)
      
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        
        // Cargar perfil si no tenemos userProfile o si es INITIAL_SESSION
        if (!userProfile || event === 'INITIAL_SESSION') {
          console.log('AuthContext: Loading userProfile for event:', event)
          // Debounce para evitar llamadas excesivas
          if (profileLoadTimeout) {
            clearTimeout(profileLoadTimeout)
          }
          
          profileLoadTimeout = setTimeout(async () => {
            try {
              await loadUserProfile(session.user.id)
            } catch (error) {
              console.error('Error loading profile in auth state change:', error)
            }
          }, 300)
        }
      } else {
        setUser(null)
        setUserProfile(null)
        setIsAuthenticated(false)
        // Limpiar el registro cuando el usuario se desloguea
        profileLoadProcessed.current.clear()
      }
      
      setLoading(false)
    })

    // Manejar cambios de visibilidad de la página con throttling
    let visibilityTimeout = null
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !loading && !userProfile?.offline && userProfile) {
        // Solo recargar si ya tenemos un perfil (no crear uno nuevo)
        // Throttle para evitar llamadas excesivas
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout)
        }
        
        visibilityTimeout = setTimeout(() => {
          // Recargar datos cuando la página vuelve a ser visible
          loadUserProfile(user.id, true).catch(error => {
            console.error('Error reloading profile on visibility change:', error)
          })
        }, 2000) // Esperar 2 segundos antes de recargar
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription?.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (profileLoadTimeout) clearTimeout(profileLoadTimeout)
      if (visibilityTimeout) clearTimeout(visibilityTimeout)
    }
  }, [user, loading])

  const value = {
    user,
    userProfile,
    loading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
    loadUserProfile,
    hasActivePlan,
    getDaysRemaining
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}