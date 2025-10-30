import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import googleDriveService from '../../lib/googleDrive'
import { db, auth } from '../../lib/supabase'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const GoogleAuthCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, userProfile, updateUserProfile, loadUserProfile } = useAuth()
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Procesando autorización de Google Drive...')
  const hasProcessed = useRef(false)

  useEffect(() => {
    const handleGoogleCallback = async () => {
      // Prevenir múltiples ejecuciones
      if (hasProcessed.current) {
        return
      }
      
      hasProcessed.current = true
        
        try {
          const code = searchParams.get('code')
          const error = searchParams.get('error')
          
          if (error) {
            setStatus('error')
            setMessage('Error en la autorización de Google Drive')
            toast.error('Error en la autorización de Google Drive')
            setTimeout(() => navigate('/dashboard'), 3000)
            return
          }
          
          if (!code) {
            console.error('GoogleAuthCallback - Código de autorización no encontrado')
            setStatus('error')
            setMessage('Código de autorización no encontrado')
            toast.error('Código de autorización no encontrado')
            setTimeout(() => navigate('/dashboard'), 3000)
            return
          }
          
          // Verificar autenticación actual - usar el usuario del contexto
          const currentUser = await auth.getCurrentUser()
          const authenticatedUser = currentUser?.data?.user
          
          console.log('GoogleAuthCallback - Debug Info:')
          console.log('- Code:', code ? 'Present' : 'Missing')
          console.log('- Error:', error)
          console.log('- Context User:', user)
          console.log('- Auth User:', authenticatedUser)
          console.log('- UserProfile:', userProfile)
          
          // Priorizar el usuario del contexto sobre el de Supabase
          // ya que el contexto debería tener el usuario correcto
          const activeUser = user || authenticatedUser
          
          if (!activeUser) {
            console.error('GoogleAuthCallback - Usuario no autenticado')
            setStatus('error')
            setMessage('Sesión expirada - Inicia sesión nuevamente')
            toast.error('Sesión expirada - Inicia sesión nuevamente')
            setTimeout(() => navigate('/login'), 3000)
            return
          }
          
          console.log('GoogleAuthCallback - Usuario activo seleccionado:', activeUser.id)

        setMessage('Intercambiando código por tokens...')
        
        // Intercambiar código por tokens
        const tokens = await googleDriveService.exchangeCodeForTokens(code)
        
        if (!tokens || !tokens.access_token) {
          throw new Error('No se pudieron obtener los tokens válidos')
        }

        setMessage('Guardando credenciales...')
        
        // Guardar tokens en la base de datos si hay refresh_token
        if (tokens.refresh_token) {
          try {
            console.log('GoogleAuthCallback - Guardando tokens:', {
              user_id: activeUser.id,
              has_refresh_token: !!tokens.refresh_token,
              has_access_token: !!tokens.access_token,
              refresh_token_length: tokens.refresh_token?.length || 0,
              access_token_length: tokens.access_token?.length || 0
            })
            
            // Usar upsert para insertar o actualizar automáticamente
            const credentialsResult = await db.userCredentials.upsert({
              user_id: activeUser.id,
              telegram_chat_id: userProfile?.telegram_id || null,
              email: activeUser.email || userProfile?.email,
              google_refresh_token: tokens.refresh_token,
              google_access_token: tokens.access_token,
              updated_at: new Date().toISOString()
            })
            
            console.log('GoogleAuthCallback - Resultado guardado:', credentialsResult)
            
            if (credentialsResult?.error) {
              console.error('Error saving credentials:', credentialsResult.error)
              // No es crítico, continuamos
            }
          } catch (credentialsError) {
            console.error('Error saving credentials:', credentialsError)
            // No es crítico, continuamos
          }
        } else {
          console.warn('GoogleAuthCallback - No refresh_token recibido:', tokens)
        }

        setMessage('Verificando conexión con Google Drive...')
        
        // Configurar tokens en el servicio antes de verificar
        googleDriveService.setTokens({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        })
        
        // Verificar que la conexión funciona listando archivos
        try {
          await googleDriveService.listFiles(null, 1)
          setStatus('success')
          setMessage('¡Google Drive conectado exitosamente!')
          toast.success('Google Drive conectado exitosamente')
          
          // Actualizar el estado del usuario si es necesario
          if (userProfile && !userProfile.google_drive_connected) {
            await updateUserProfile({ google_drive_connected: true })
          }
          
          // Recargar el perfil para incluir los nuevos tokens de Google Drive
          // Esto es importante para que el dashboard muestre el estado correcto
          console.log('GoogleAuthCallback - Recargando perfil del usuario...')
          
          // Si el usuario está autenticado, debe existir en la tabla users
          // No necesitamos verificar ni crear el usuario ya que está logueado
          try {
            // Recargar el perfil para incluir los tokens de Google Drive
            const reloadedProfile = await loadUserProfile(activeUser.id)
            console.log('GoogleAuthCallback - Perfil recargado:', {
              has_google_refresh_token: !!reloadedProfile?.google_refresh_token,
              has_google_access_token: !!reloadedProfile?.google_access_token,
              profile_keys: Object.keys(reloadedProfile || {})
            })
          } catch (profileError) {
            console.error('GoogleAuthCallback - Error recargando perfil:', profileError)
          }
          
          setTimeout(() => navigate('/dashboard'), 2000)
        } catch (driveError) {
          console.error('Error testing Drive connection:', driveError)
          setStatus('warning')
          setMessage('Tokens guardados, pero hay problemas con la conexión a Drive')
          toast.warning('Conexión parcial con Google Drive')
          setTimeout(() => navigate('/dashboard'), 3000)
        }
        
      } catch (error) {
        console.error('Error in Google callback:', error)
        setStatus('error')
        
        // Mostrar mensaje específico según el tipo de error
        let errorMessage = 'Error procesando la autorización de Google Drive'
        if (error.message.includes('Límite de solicitudes excedido')) {
          errorMessage = 'Límite de solicitudes excedido. Intenta nuevamente en unos minutos.'
        } else if (error.message.includes('Código de autorización inválido')) {
          errorMessage = 'Código de autorización expirado. Intenta conectar Google Drive nuevamente.'
        } else if (error.message.includes('Credenciales de Google inválidas')) {
          errorMessage = 'Error de configuración. Contacta al administrador.'
        } else if (error.message.includes('No se pudieron obtener los tokens')) {
          errorMessage = 'Error obteniendo permisos de Google Drive. Intenta nuevamente.'
        }
        
        setMessage(errorMessage)
        toast.error(errorMessage)
        setTimeout(() => navigate('/dashboard'), 5000)
      }
    }

    handleGoogleCallback()
  }, [searchParams, navigate, user, userProfile, updateUserProfile])

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin h-12 w-12 text-primary-600">
            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )
      case 'success':
        return (
          <div className="h-12 w-12 text-green-600">
            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="h-12 w-12 text-yellow-600">
            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="h-12 w-12 text-red-600">
            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      default:
        return null
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-primary-600'
      case 'success':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Conectando Google Drive
          </h2>
          
          <p className={`text-lg ${getStatusColor()} mb-6`}>
            {message}
          </p>
          
          {status === 'processing' && (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-pulse h-2 bg-primary-200 rounded w-8"></div>
              <div className="animate-pulse h-2 bg-primary-200 rounded w-8 delay-75"></div>
              <div className="animate-pulse h-2 bg-primary-200 rounded w-8 delay-150"></div>
            </div>
          )}
          
          {(status === 'success' || status === 'warning' || status === 'error') && (
            <div className="mt-6">
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary"
              >
                Ir al Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GoogleAuthCallback