import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import embeddingsService from '../../lib/embeddings'
import {
  UserIcon,
  CreditCardIcon,
  FolderIcon,
  DocumentIcon,
  CloudIcon,
  CalendarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import TokenUsage from '../embeddings/TokenUsage'
import TemplateDownload from '../templates/TemplateDownload'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user, userProfile, hasActivePlan, getDaysRemaining } = useAuth()
  const [payments, setPayments] = useState([])
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalFolders: 0,
    totalFiles: 0,
    storageUsed: 0,
    tokensUsed: 0
  })
  const [userExtensions, setUserExtensions] = useState([])
  const [plans, setPlans] = useState([])

  // Timeout de seguridad para evitar loading infinito
  useEffect(() => {
    const maxLoadingTimeout = setTimeout(() => {
      console.log('Dashboard: Max loading timeout reached, forcing loading to false')
      setLoading(false)
    }, 10000) // 10 segundos máximo

    return () => clearTimeout(maxLoadingTimeout)
  }, [])

  useEffect(() => {
    let loadTimeout = null
    
    if (user && userProfile) {
      // Debounce para evitar llamadas excesivas
      loadTimeout = setTimeout(() => {
        loadDashboardData()
      }, 300)
    } else if (user && !userProfile) {
      // Usuario existe pero userProfile aún no se ha cargado, mantener loading
      console.log('Dashboard: User exists but userProfile not loaded yet')
    } else {
      // Si no hay usuario, asegurar que loading sea false
      setLoading(false)
    }
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout)
      }
    }
  }, [user, userProfile])

  // Efecto separado para verificar Google Drive cuando userProfile cambie
  useEffect(() => {
    if (userProfile) {
      checkGoogleDriveConnection()
    }
  }, [userProfile])

  const loadDashboardData = async () => {
    if (!user) {
      console.log('Dashboard: No user found, skipping load')
      setLoading(false)
      return
    }
    
    if (!userProfile) {
      console.log('Dashboard: UserProfile not available yet, skipping load')
      return
    }
    
    console.log('Dashboard: Starting to load data for user:', user.id, 'with plan:', userProfile.current_plan_id)
    
    try {
      setLoading(true)
      
      // Cargar estadísticas reales desde las tablas correspondientes
      console.log('Dashboard: Loading real stats from database')
      
      let realStats = {
        totalFolders: 0,
        totalFiles: 0,
        storageUsed: 0,
        tokensUsed: 0,
        tokenLimit: 0
      }
      
      // Obtener carpetas desde carpetas_usuario usando columna administrador
      try {
        const { data: foldersData, error: foldersError } = await db.userFolders.getByAdministrador(user.email)
        if (!foldersError && foldersData) {
          realStats.totalFolders = foldersData.length
          console.log('Dashboard: Folders loaded:', realStats.totalFolders)
        }
      } catch (folderError) {
        console.error('Error loading folders:', folderError)
      }
      
      // Obtener archivos contando carpetas_usuario donde administrador = user.email
      try {
        const { data: userFoldersData, error: userFoldersError } = await supabase
          .from('carpetas_usuario')
          .select('*')
          .eq('administrador', user.email)
        
        if (!userFoldersError && userFoldersData) {
          realStats.totalFiles = userFoldersData.length
          console.log('Dashboard: Total files (carpetas_usuario) loaded:', realStats.totalFiles)
        }
      } catch (fileError) {
        console.error('Error loading files:', fileError)
      }
      
      // Calcular almacenamiento desde documentos_entrenador (sin cargar embeddings)
      try {
        const { data: chunksData, error: chunksError } = await supabase
          .from('documentos_entrenador')
          .select('id')
          .eq('entrenador', user.email)

        if (!chunksError && chunksData) {
          // Estimación simple basada en número de documentos
          realStats.storageUsed = chunksData.length * 1024 // 1KB por documento estimado
          console.log('Dashboard: Storage estimated:', realStats.storageUsed, 'bytes for', chunksData.length, 'documents')
        }
      } catch (storageError) {
        console.error('Error calculating storage:', storageError)
      }
      
      // Obtener límite de tokens del plan actual PRIMERO
      let planTokenLimit = 1000 // valor por defecto para plan gratuito
      console.log('Dashboard: UserProfile current_plan_id:', userProfile.current_plan_id)
      
      if (userProfile.current_plan_id) {
        try {
          console.log('Dashboard: Fetching plan data for plan ID:', userProfile.current_plan_id)
          const { data: planData, error: planError } = await supabase
            .from('plans')
            .select('token_limit_usage')
            .eq('id', userProfile.current_plan_id)
            .maybeSingle()
          
          console.log('Dashboard: Plan query result:', { planData, planError })
          
          if (!planError && planData) {
            planTokenLimit = planData.token_limit_usage || 1000
            console.log('Dashboard: Plan token limit loaded:', planTokenLimit)
          } else {
            console.warn('Dashboard: No plan data found or error occurred, using default limit')
          }
        } catch (planError) {
          console.error('Error loading plan token limit:', planError)
        }
      } else {
        console.log('Dashboard: No current_plan_id found, using default token limit:', planTokenLimit)
      }
      
      // Obtener tokens usados y establecer el límite correcto
      try {
        const { data: tokenData, error: tokenError } = await supabase
          .from('user_tokens_usage')
          .select('tokens_used')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!tokenError && tokenData) {
          realStats.tokensUsed = tokenData.tokens_used || 0
          console.log('Dashboard: Tokens used loaded:', realStats.tokensUsed)
        }
        // Usar SIEMPRE el límite del plan, no el de user_tokens_usage
        realStats.tokenLimit = planTokenLimit
        console.log('Dashboard: Using plan token limit:', realStats.tokenLimit)
      } catch (tokenError) {
        console.error('Error loading tokens:', tokenError)
        realStats.tokenLimit = planTokenLimit
      }
      
      setStats(realStats)
      
      // La verificación de Google Drive se maneja automáticamente en useEffect
      
      // Cargar planes disponibles
      console.log('Dashboard: Loading plans')
      try {
        const { data: plansData, error: plansError } = await supabase
          .from('plans')
          .select('*')
        if (!plansError && plansData) {
          console.log('Dashboard: Plans loaded successfully:', plansData.length)
          setPlans(plansData)
        }
      } catch (planError) {
        console.error('Network error loading plans:', planError)
      }
      
      // Cargar extensiones del usuario
      console.log('Dashboard: Loading user extensions')
      try {
        const { data: extensionsData, error: extensionsError } = await supabase
          .from('plan_extensiones')
          .select(`
            *,
            extensiones (
              id,
              name,
              name_es,
              description,
              description_es,
              price
            )
          `)
          .eq('user_id', user.id)
        
        if (!extensionsError && extensionsData) {
    
          setUserExtensions(extensionsData)
        }
      } catch (extensionError) {
        console.error('Network error loading user extensions:', extensionError)
      }
      
      // Cargar historial de pagos con manejo de errores mejorado
      console.log('Dashboard: Loading payment history')
      try {
        const { data: paymentsData, error: paymentsError } = await db.payments.getByUserId(user.id)
        if (!paymentsError && paymentsData) {
          console.log('Dashboard: Payments loaded successfully:', paymentsData.length)
          setPayments(paymentsData)
        } else if (paymentsError) {
          console.error('Error loading payments:', paymentsError)
          setPayments([]) // Establecer array vacío en caso de error
        }
      } catch (paymentError) {
        console.error('Network error loading payments:', paymentError)
        setPayments([]) // Establecer array vacío en caso de error de red
      }
      
      console.log('Dashboard: Data loading completed successfully')
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      // No mostrar toast de error para evitar spam al usuario
      console.log('Dashboard cargado con datos básicos debido a errores de conectividad')
    } finally {
      console.log('Dashboard: Setting loading to false')
      setLoading(false)
    }
  }

  const checkGoogleDriveConnection = () => {
    // Usar la información ya disponible en userProfile desde AuthContext
    // que incluye las credenciales de Google Drive
    const isConnected = !!(userProfile?.google_refresh_token && userProfile.google_refresh_token.trim() !== '')
    setIsGoogleDriveConnected(isConnected)
    console.log('Dashboard: Google Drive connection status:', isConnected)
  }

  const handleConnectGoogleDrive = () => {
    try {
      const authUrl = googleDriveService.generateAuthUrl()
      window.location.href = authUrl
    } catch (error) {
      console.error('Error getting auth URL:', error)
      toast.error('Error al conectar con Google Drive')
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getPlanName = () => {
    if (!userProfile?.current_plan_id) return 'Sin plan'
    const plan = plans.find(p => p.id === userProfile.current_plan_id)
    return plan?.name || 'Plan desconocido'
  }

  const getStoragePercentage = () => {
    if (!userProfile?.current_plan_id) return 0
    const plan = plans.find(p => p.id === userProfile.current_plan_id)
    const limit = plan?.storage_limit_bytes || 1024 * 1024 * 1024 // 1GB por defecto
    return Math.min((stats.storageUsed / limit) * 100, 100)
  }

  // Verificar si el usuario tiene una extensión específica activa
  const hasExtension = (extKey) => {
    const key = (extKey || '').toLowerCase()
    return userExtensions?.some((userExt) => {
      const n = userExt?.extensiones?.name?.toLowerCase()
      const nes = userExt?.extensiones?.name_es?.toLowerCase()
      return n === key || nes === key
    })
  }

  if (loading) {
    return <LoadingSpinner text="Cargando dashboard..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ¡Bienvenido, {userProfile?.name || user?.email}!
            </h1>
            <p className="text-gray-600">
              Gestiona tus planes, carpetas y archivos desde tu dashboard personal.
            </p>
          </div>
   <div className="ml-6">
          <a
            href="https://t.me/brifybeta_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <svg
              className="w-5 h-5 mr-2"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Ir a Telegram
          </a>
          {/* Botón WhatsApp a la derecha */}
          <a
            href="https://wa.me/56939558133"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg ml-3"
          >
            <svg
              className="w-5 h-5 mr-2"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.4 0 0 5.1 0 11.4c0 2 .6 3.9 1.7 5.6L0 24l7-1.8c1.5.4 3 .6 4.5.6 6.6 0 12-5.1 12-11.4S18.6 0 12 0zm5.9 16.7c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-3.5-1.1-5.9-3.2-7.2-6.2-.3-.7-.3-1.3-.2-1.7.1-.5.5-1.2 1-1.3.2-.1.5-.1.8 0 .2.1.5.4.6.7.2.5.5 1.3.6 1.5.1.2.1.4 0 .6-.2.4-.5.6-.8.9-.1.1-.2.2-.1.4.4.9 1.1 1.7 2 2.3.9.6 1.6.8 2.1.6.2-.1.3-.3.5-.6.2-.3.4-.6.6-.7.1-.1.3-.1.5 0 .2.1 1.2.6 1.4.7.2.1.3.1.4.2.2.2.2.8 0 1.2z"/>
            </svg>
            WhatsApp
          </a>
        </div>
            

        </div>
      </div>

      {/* Alertas */}
      {!hasActivePlan() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                No tienes un plan activo
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Adquiere un plan para acceder a todas las funcionalidades.
              </p>
              <Link
                to="/plans"
                className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900 mt-2 inline-block"
              >
                Ver planes disponibles
              </Link>
            </div>
          </div>
        </div>
      )}

      {!isGoogleDriveConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CloudIcon className="h-5 w-5 text-blue-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Google Drive no conectado
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  Conecta tu cuenta de Google Drive para gestionar archivos.
                </p>
              </div>
            </div>
            <button
              onClick={handleConnectGoogleDrive}
              className="btn-primary text-sm"
            >
              Conectar Drive
            </button>
          </div>
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <FolderIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Carpetas</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFolders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <DocumentIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Archivos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Almacenamiento</p>
              <p className="text-2xl font-bold text-gray-900">{formatBytes(stats.storageUsed)}</p>
              {hasActivePlan() && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Usado: {formatBytes(stats.storageUsed)}</span>
                    <span>Límite: {formatBytes(plans.find(p => p.id === userProfile?.current_plan_id)?.storage_limit_bytes || 0)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        getStoragePercentage() >= 90 ? 'bg-red-500' : 
                        getStoragePercentage() >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(getStoragePercentage(), 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{getStoragePercentage().toFixed(1)}% usado</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100">
              <CreditCardIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600">Tokens Usados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.tokensUsed.toLocaleString()}</p>
              {hasActivePlan() && stats.tokenLimit > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Usados: {stats.tokensUsed.toLocaleString()}</span>
                    <span>Límite: {stats.tokenLimit.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        (stats.tokensUsed / stats.tokenLimit) * 100 >= 90 ? 'bg-red-500' : 
                        (stats.tokensUsed / stats.tokenLimit) * 100 >= 70 ? 'bg-yellow-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${Math.min((stats.tokensUsed / stats.tokenLimit) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((stats.tokensUsed / stats.tokenLimit) * 100).toFixed(1)}% usado • 
                    {(stats.tokenLimit - stats.tokensUsed).toLocaleString()} disponibles
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Información del Usuario */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <UserIcon className="h-5 w-5 mr-2" />
            Información Personal
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Email</p>
              <p className="text-sm text-gray-900">{user?.email}</p>
            </div>
            {userProfile?.telegram_id && (
              <div>
                <p className="text-sm font-medium text-gray-600">ID Telegram</p>
                <p className="text-sm text-gray-900">{userProfile.telegram_id}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Fecha de Registro</p>
              <p className="text-sm text-gray-900">
                {userProfile?.created_at ? formatDate(userProfile.created_at) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Google Drive</p>
              <div className="flex items-center mt-1">
                {isGoogleDriveConnected ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-600">Conectado</span>
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-2" />
                    <span className="text-sm text-yellow-600">No conectado</span>
                    <button
                      onClick={handleConnectGoogleDrive}
                      className="ml-2 text-xs text-primary-600 hover:text-primary-700 underline"
                    >
                      Conectar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel del Plan */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CreditCardIcon className="h-5 w-5 mr-2" />
            Plan Actual
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Tipo de Plan</p>
              <p className="text-sm text-gray-900">
                {getPlanName()}
              </p>
            </div>
            {userProfile?.plan_expiration && (
              <div>
                <p className="text-sm font-medium text-gray-600">Fecha de Expiración</p>
                <p className="text-sm text-gray-900">
                  {formatDate(userProfile.plan_expiration)}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Estado</p>
              <div className="flex items-center mt-1">
                {hasActivePlan() ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-600">
                      Activo ({getDaysRemaining()} días restantes)
                    </span>
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-sm text-red-600">Inactivo</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Barra de progreso de almacenamiento */}
            {hasActivePlan() && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Almacenamiento</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      getStoragePercentage() >= 90 ? 'bg-red-500' : 
                      getStoragePercentage() >= 70 ? 'bg-yellow-500' : 'bg-primary-600'
                    }`}
                    style={{ width: `${Math.min(getStoragePercentage(), 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Usado: {formatBytes(stats.storageUsed)}</span>
                  <span>Límite: {formatBytes(plans.find(p => p.id === userProfile?.current_plan_id)?.storage_limit_bytes || 0)}</span>
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">{getStoragePercentage().toFixed(1)}% usado</p>
              </div>
            )}
            
            {/* Extensiones Activas */}
            {userExtensions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Extensiones Activas</p>
                <div className="space-y-2">
                  {userExtensions.map((userExt) => (
                    <div key={userExt.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-sm font-medium text-green-800">
                          {userExt.extensiones?.name_es || userExt.extensiones?.name}
                        </span>
                      </div>
                      <span className="text-xs text-green-600 font-medium">
                        ${parseInt(userExt.extensiones?.price || 0).toLocaleString()} CLP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel de Acciones Rápidas */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Acciones Rápidas
          </h2>
          <div className="space-y-3">
            <Link
              to="/folders"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
            >
              <PlusIcon className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">Crear Carpeta</span>
            </Link>
            
            <Link
              to="/folders"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
            >
              <FolderIcon className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">Ver Carpetas</span>
            </Link>
            
            <Link
              to="/files"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
            >
              <DocumentIcon className="h-5 w-5 text-primary-600 mr-3" />
              <span className="text-sm font-medium text-gray-900">Subir Archivos</span>
            </Link>
            
            {!hasActivePlan() && (
              <Link
                to="/plans"
                className="flex items-center p-3 rounded-lg bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors duration-200"
              >
                <CreditCardIcon className="h-5 w-5 text-primary-600 mr-3" />
                <span className="text-sm font-medium text-primary-900">Ver Planes</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Plantilla de Rutina - Solo disponible si la extensión Entrenador está activa */}
      {hasActivePlan() && hasExtension('entrenador') && (
        <div className="mt-8">
          <TemplateDownload />
        </div>
      )}

      {/* Historial de Compras */}
      {payments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Historial de Compras
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiración
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.slice(0, 5).map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.plans?.name || 'Plan desconocido'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${payment.amount_usd}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-800'
                          : payment.payment_status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.payment_status === 'paid' ? 'Completado' : 
                         payment.payment_status === 'pending' ? 'Pendiente' : 'Fallido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paid_at ? formatDate(payment.paid_at) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        if (payment.plan_expiration) {
                          return formatDate(payment.plan_expiration)
                        }
                        if (payment.paid_at && payment.plans?.duration_days) {
                          const paidDate = new Date(payment.paid_at)
                          const expirationDate = new Date(paidDate)
                          expirationDate.setDate(paidDate.getDate() + payment.plans.duration_days)
                          return formatDate(expirationDate.toISOString())
                        }
                        return 'N/A'
                      })()} 
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length > 5 && (
            <div className="mt-4 text-center">
              <Link
                to="/profile"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Ver historial completo
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Sección de Uso de Tokens */}
      <div className="mt-8">
        <TokenUsage />
      </div>
    </div>
  )
}

export default Dashboard