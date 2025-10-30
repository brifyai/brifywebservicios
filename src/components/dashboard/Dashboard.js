import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import {
  UserIcon,
  CreditCardIcon,
  FolderIcon,
  DocumentIcon,
  CloudIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ClockIcon,
  FireIcon,
  BellIcon,
  CogIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  DocumentTextIcon,
  XMarkIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  PlayIcon,
  FolderOpenIcon,
  CpuChipIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user, userProfile, hasActivePlan } = useAuth()
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  
  // Estados para las mejoras
  const [viewMode, setViewMode] = useState('grid') // grid, compact, detailed
  const [widgets, setWidgets] = useState({
    quickActions: true,
    metrics: true,
    recentActivity: true,
    systemStatus: true,
    aiInsights: true
  })
  const [showWidgetMenu, setShowWidgetMenu] = useState(false)
  
  // Estados para métricas en tiempo real
  const [metrics, setMetrics] = useState({
    tokensUsed: 0,
    tokensLimit: 10000,
    documentsProcessed: 0,
    searchesPerformed: 0,
    chatsCreated: 0,
    syncStatus: 'idle',
    systemHealth: 'healthy'
  })
  
  // Estados para accesos rápidos
  const [recentDocuments, setRecentDocuments] = useState([])
  const [savedSearches, setSavedSearches] = useState([])
  const [recentChats, setRecentChats] = useState([])
  
  // Estados para estado del sistema
  const [systemStatus, setSystemStatus] = useState({
    syncInProgress: false,
    lastSync: null,
    services: {
      embeddings: 'healthy',
      groq: 'healthy',
      drive: 'healthy'
    },
    notifications: []
  })
  
  // Estados para funcionalidades de IA
  const [aiInsights, setAiInsights] = useState({
    recommendations: [],
    trends: [],
    summaries: []
  })

  // Timeout de seguridad para evitar loading infinito
  useEffect(() => {
    const maxLoadingTimeout = setTimeout(() => {
      console.log('Dashboard: Max loading timeout reached, forcing loading to false')
      setLoading(false)
    }, 10000)

    return () => clearTimeout(maxLoadingTimeout)
  }, [])

  useEffect(() => {
    let loadTimeout = null
    
    if (user && userProfile) {
      loadTimeout = setTimeout(() => {
        loadDashboardData()
      }, 300)
    } else if (user && !userProfile) {
      console.log('Dashboard: User exists but userProfile not loaded yet')
    } else {
      setLoading(false)
    }
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout)
      }
    }
  }, [user, userProfile])

  useEffect(() => {
    if (userProfile) {
      checkGoogleDriveConnection()
      loadMetrics()
      loadQuickAccessData()
      loadSystemStatus()
      loadAIInsights()
    }
  }, [userProfile])

  const loadDashboardData = async () => {
    if (!user || !userProfile) return

    console.log('Dashboard: Starting to load data for user:', user.id)

    try {
      setLoading(true)
      const isNew = !hasActivePlan() && !isGoogleDriveConnected
      setIsNewUser(isNew)
      console.log('Dashboard: Data loading completed successfully')
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    try {
      // Cargar uso de tokens
      const { data: tokenData } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Cargar estadísticas de documentos
      const { data: docStats } = await supabase
        .from('documentos_usuario_entrenador')
        .select('id, created_at')
        .eq('user_id', user.id)

      // Simular datos de búsquedas y chats
      const simulatedMetrics = {
        tokensUsed: tokenData?.tokens_used || 0,
        tokensLimit: userProfile?.plan?.token_limit || 10000,
        documentsProcessed: docStats?.length || 0,
        searchesPerformed: Math.floor(Math.random() * 50) + 10,
        chatsCreated: Math.floor(Math.random() * 30) + 5,
        syncStatus: isGoogleDriveConnected ? 'synced' : 'pending',
        systemHealth: 'healthy'
      }

      setMetrics(simulatedMetrics)
    } catch (error) {
      console.error('Error loading metrics:', error)
    }
  }

  const loadQuickAccessData = async () => {
    try {
      // Cargar documentos recientes
      const { data: recentDocs } = await supabase
        .from('documentos_usuario_entrenador')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentDocuments(recentDocs || [])

      // Simular búsquedas guardadas y chats recientes
      setSavedSearches([
        { id: 1, query: 'contratos de arrendamiento', frequency: 5 },
        { id: 2, query: 'informes financieros Q3', frequency: 3 },
        { id: 3, query: 'políticas internas RRHH', frequency: 2 }
      ])

      setRecentChats([
        { id: 1, title: 'Análisis de contrato', timestamp: new Date(Date.now() - 3600000) },
        { id: 2, title: 'Resumen de informe', timestamp: new Date(Date.now() - 7200000) },
        { id: 3, title: 'Consulta legal', timestamp: new Date(Date.now() - 10800000) }
      ])
    } catch (error) {
      console.error('Error loading quick access data:', error)
    }
  }

  const loadSystemStatus = async () => {
    try {
      const status = {
        syncInProgress: false,
        lastSync: new Date(Date.now() - 3600000),
        services: {
          embeddings: 'healthy',
          groq: 'healthy',
          drive: isGoogleDriveConnected ? 'healthy' : 'disconnected'
        },
        notifications: [
          { id: 1, type: 'info', message: 'Nuevas funciones de IA disponibles', timestamp: new Date() },
          { id: 2, type: 'success', message: 'Sincronización completada', timestamp: new Date(Date.now() - 1800000) }
        ]
      }

      setSystemStatus(status)
    } catch (error) {
      console.error('Error loading system status:', error)
    }
  }

  const loadAIInsights = async () => {
    try {
      const insights = {
        recommendations: [
          { id: 1, text: 'Considera organizar tus documentos en carpetas temáticas', priority: 'medium' },
          { id: 2, text: 'Tienes 15 documentos sin procesar, actívalos para búsquedas', priority: 'high' },
          { id: 3, text: 'Tu uso de tokens increased un 20% esta semana', priority: 'low' }
        ],
        trends: [
          { metric: 'Búsquedas', value: 25, change: 15, trend: 'up' },
          { metric: 'Tokens usados', value: 1500, change: -5, trend: 'down' },
          { metric: 'Documentos procesados', value: 45, change: 8, trend: 'up' }
        ],
        summaries: [
          { id: 1, title: 'Actividad semanal', content: 'Realizaste 23 búsquedas y procesaste 8 documentos nuevos.' },
          { id: 2, title: 'Uso de IA', content: 'Conversaciones con IA: 12. Tokens utilizados: 1,500.' }
        ]
      }

      setAiInsights(insights)
    } catch (error) {
      console.error('Error loading AI insights:', error)
    }
  }

  const checkGoogleDriveConnection = () => {
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

  const toggleWidget = (widgetName) => {
    setWidgets(prev => ({
      ...prev,
      [widgetName]: !prev[widgetName]
    }))
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('es-CL').format(num)
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Nunca'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) return `Hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Hace ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    return `Hace ${diffDays} d`
  }

  if (loading) {
    return <LoadingSpinner text="Cargando dashboard..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Principal */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-black rounded-2xl shadow-lg flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Bienvenido a Brify AI
                </h1>
                <p className="text-gray-600 mt-1">
                  Tu asistente inteligente para gestionar documentos y automatizar procesos
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Estado general del sistema */}
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium ${
                systemStatus.services.embeddings === 'healthy' && 
                systemStatus.services.groq === 'healthy' && 
                systemStatus.services.drive === 'healthy' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  systemStatus.services.embeddings === 'healthy' && 
                  systemStatus.services.groq === 'healthy' && 
                  systemStatus.services.drive === 'healthy' 
                    ? 'bg-green-500' 
                    : 'bg-yellow-500'
                }`}></div>
                Sistema operativo
              </div>
              
              {/* Menu de personalización */}
              <div className="relative">
                <button
                  onClick={() => setShowWidgetMenu(!showWidgetMenu)}
                  className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <CogIcon className="h-5 w-5 text-gray-600" />
                </button>
                
                {showWidgetMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Personalizar Dashboard</h3>
                      <div className="space-y-2">
                        {Object.entries(widgets).map(([key, value]) => (
                          <label key={key} className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">
                              {key === 'quickActions' ? 'Acciones Rápidas' :
                               key === 'metrics' ? 'Métricas' :
                               key === 'recentActivity' ? 'Actividad Reciente' :
                               key === 'systemStatus' ? 'Estado del Sistema' :
                               'Insights de IA'}
                            </span>
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={() => toggleWidget(key)}
                              className="rounded text-blue-500 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <a
                href="https://t.me/brifybeta_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Ir a Telegram
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Experiencia de Onboarding para Nuevos Usuarios */}
        {isNewUser && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-black to-gray-900 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Comienza tu viaje con Brify AI</h2>
                  <p className="text-gray-300 mt-1">Sigue estos pasos para configurar tu cuenta</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-white">1</span>
                    </div>
                    <h3 className="text-lg font-semibold">Conecta Google Drive</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Vincula tu cuenta de Google Drive para acceder a tus documentos y archivos.
                  </p>
                  <button
                    onClick={handleConnectGoogleDrive}
                    className="w-full bg-white text-black font-medium py-2 px-4 rounded-xl hover:bg-gray-100 transition-colors duration-200"
                  >
                    Conectar Drive
                  </button>
                </div>

                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-white">2</span>
                    </div>
                    <h3 className="text-lg font-semibold">Elige un Plan</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Selecciona el plan que mejor se adapte a tus necesidades y comienza a usar IA.
                  </p>
                  <Link
                    to="/plans"
                    className="w-full bg-white text-black font-medium py-2 px-4 rounded-xl hover:bg-gray-100 transition-colors duration-200 inline-block text-center"
                  >
                    Ver Planes
                  </Link>
                </div>

                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-white">3</span>
                    </div>
                    <h3 className="text-lg font-semibold">Explora Funciones</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Una vez configurado, explora el chat IA, gestión de archivos y más herramientas.
                  </p>
                  <div className="flex space-x-2">
                    <Link
                      to="/search"
                      className="flex-1 bg-white/10 text-white font-medium py-2 px-3 rounded-lg hover:bg-white/20 transition-colors duration-200 text-center text-sm"
                    >
                      Chat General
                    </Link>
                    <Link
                      to="/folders"
                      className="flex-1 bg-white/10 text-white font-medium py-2 px-3 rounded-lg hover:bg-white/20 transition-colors duration-200 text-center text-sm"
                    >
                      Archivos
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACCIONES RÁPIDAS - PRIORIDAD #1 */}
        {widgets.quickActions && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">¿Qué quieres hacer hoy?</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <PlayIcon className="h-4 w-4" />
                <span>Acciones principales</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Chat IA - La acción más importante */}
              <Link
                to="/search"
                className="group bg-gradient-to-br from-purple-600 to-purple-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
                  </div>
                  <ArrowRightIcon className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-2">Chat General</h3>
                <p className="text-purple-100 text-sm mb-4">
                  Conversa con tus documentos usando inteligencia artificial
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-200">Iniciar conversación</span>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-300">Disponible</span>
                  </div>
                </div>
              </Link>

              {/* Gestionar Archivos */}
              <Link
                to="/folders"
                className="group bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <FolderOpenIcon className="h-8 w-8 text-white" />
                  </div>
                  <ArrowRightIcon className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-2">Gestionar Archivos</h3>
                <p className="text-blue-100 text-sm mb-4">
                  Organiza y administra tus documentos con Google Drive
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-200">Ver archivos</span>
                  <span className="text-xs text-blue-300">{metrics.documentsProcessed} documentos</span>
                </div>
              </Link>

              {/* Búsqueda Legal */}
              <Link
                to="/abogado"
                className="group bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <MagnifyingGlassIcon className="h-8 w-8 text-white" />
                  </div>
                  <ArrowRightIcon className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-2">Chat Legal</h3>
                <p className="text-green-100 text-sm mb-4">
                  Accede a la base de datos de leyes chilenas
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-200">Consultar leyes</span>
                  <span className="text-xs text-green-300">Base actualizada</span>
                </div>
              </Link>

              {/* Ver Plan */}
              <Link
                to="/plans"
                className="group bg-gradient-to-br from-orange-600 to-orange-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <CreditCardIcon className="h-8 w-8 text-white" />
                  </div>
                  <ArrowRightIcon className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-2">Mi Plan</h3>
                <p className="text-orange-100 text-sm mb-[35px]">
                  Gestiona tu suscripción y beneficios
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-orange-200">Ver detalles</span>
                  <span className="text-xs text-orange-300">
                    {hasActivePlan() ? 'Activo' : 'Gratis'}
                  </span>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* MÉTRICAS Y ESTADO - PRIORIDAD #2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Métricas principales */}
          {widgets.metrics && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Tu Actividad</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <ChartBarIcon className="h-4 w-4" />
                  <span>Actualizado en tiempo real</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tokens - Métrica más importante */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[163px] flex flex-col">
                  {/* Tokens - Métrica más importante */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm">
                      <CpuChipIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className={`flex items-center text-xs ${
                      metrics.tokensUsed / metrics.tokensLimit > 0.8 ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {metrics.tokensUsed / metrics.tokensLimit > 0.8 ? (
                        <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                      ) : (
                        <MinusIcon className="h-3 w-3 mr-1" />
                      )}
                      {Math.round((metrics.tokensUsed / metrics.tokensLimit) * 100)}%
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {formatNumber(metrics.tokensUsed)}
                  </h3>
                  <p className="text-xs text-gray-600 mb-2">Tokens utilizados este mes</p>
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${
                        metrics.tokensUsed / metrics.tokensLimit > 0.8 ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min((metrics.tokensUsed / metrics.tokensLimit) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Límite: {formatNumber(metrics.tokensLimit)}
                  </p>
                </div>

                {/* Documentos */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[163px] flex flex-col">
                  {/* Documentos */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm">
                      <DocumentIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex items-center text-green-500 text-xs">
                      <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                      +12%
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {formatNumber(metrics.documentsProcessed)}
                  </h3>
                  <p className="text-xs text-gray-600 mb-2">Documentos procesados</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <CheckCircleIcon className="h-3 w-3 mr-1 text-green-500" />
                    Todos sincronizados
                  </div>
                </div>

                {/* Búsquedas */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[163px] flex flex-col">
                  {/* Búsquedas */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm">
                      <MagnifyingGlassIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex items-center text-purple-500 text-xs">
                      <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                      +8%
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {formatNumber(metrics.searchesPerformed)}
                  </h3>
                  <p className="text-xs text-gray-600 mb-2">Búsquedas realizadas</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <FireIcon className="h-3 w-3 mr-1 text-orange-500" />
                    Alta actividad
                  </div>
                </div>

                {/* Chats */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[163px] flex flex-col">
                  {/* Chats */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-sm">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex items-center text-pink-500 text-xs">
                      <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                      +15%
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {formatNumber(metrics.chatsCreated)}
                  </h3>
                  <p className="text-xs text-gray-600 mb-2">Conversaciones con IA</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <SparklesIcon className="h-3 w-3 mr-1 text-purple-500" />
                    IA respondiendo
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Estado del sistema */}
          {widgets.systemStatus && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Estado del Sistema</h2>
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                  systemStatus.services.embeddings === 'healthy' && 
                  systemStatus.services.groq === 'healthy' && 
                  systemStatus.services.drive === 'healthy' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    systemStatus.services.embeddings === 'healthy' && 
                    systemStatus.services.groq === 'healthy' && 
                    systemStatus.services.drive === 'healthy' 
                      ? 'bg-green-500' 
                      : 'bg-yellow-500'
                  }`}></div>
                  Todo operativo
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm min-h-[341px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        systemStatus.services.embeddings === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">Inserción de Archivos</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      systemStatus.services.embeddings === 'healthy'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {systemStatus.services.embeddings === 'healthy' ? 'Operativo' : 'Error'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        systemStatus.services.groq === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">IA Brify</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      systemStatus.services.groq === 'healthy'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {systemStatus.services.groq === 'healthy' ? 'Operativo' : 'Error'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        systemStatus.services.drive === 'healthy' ? 'bg-green-500' : 
                        systemStatus.services.drive === 'disconnected' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">Google Drive</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      systemStatus.services.drive === 'healthy' 
                        ? 'bg-green-100 text-green-700' 
                        : systemStatus.services.drive === 'disconnected'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {systemStatus.services.drive === 'healthy' ? 'Conectado' : 
                       systemStatus.services.drive === 'disconnected' ? 'Desconectado' : 'Error'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CloudIcon className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Última sincronización</span>
                    </div>
                    <span className="text-xs text-blue-700">
                      {formatTimestamp(systemStatus.lastSync)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ACTIVIDAD RECIENTE - PRIORIDAD #3 */}
        {widgets.recentActivity && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Actividad Reciente</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <ClockIcon className="h-4 w-4" />
                <span>Actualizado en tiempo real</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Actividades principales */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Últimas actividades</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <DocumentIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Nuevo documento procesado</p>
                      <p className="text-xs text-gray-500">Contrato de servicios.pdf</p>
                    </div>
                    <span className="text-xs text-gray-500">Hace 5 min</span>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Nueva conversación con IA</p>
                      <p className="text-xs text-gray-500">Análisis de informe financiero</p>
                    </div>
                    <span className="text-xs text-gray-500">Hace 15 min</span>
                  </div>
                  
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <MagnifyingGlassIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Búsqueda por Texto realizada</p>
                      <p className="text-xs text-gray-500">"cláusulas de confidencialidad"</p>
                    </div>
                    <span className="text-xs text-gray-500">Hace 30 min</span>
                  </div>
                </div>
              </div>

              {/* Documentos y conversaciones recientes */}
              <div className="space-y-4">
                {/* Documentos Recientes */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Documentos Recientes</h3>
                    <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    {recentDocuments.length > 0 ? (
                      recentDocuments.slice(0, 3).map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                              <DocumentIcon className="h-3 w-3 text-blue-600" />
                            </div>
                            <p className="text-xs font-medium text-gray-900 truncate max-w-32">
                              {doc.nombre_archivo || `Documento ${doc.id}`}
                            </p>
                          </div>
                          <EyeIcon className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-2">
                        No hay documentos recientes
                      </p>
                    )}
                  </div>
                </div>

                {/* Conversaciones Recientes */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm mt-[47px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Conversaciones</h3>
                    <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    {recentChats.map(chat => (
                      <div key={chat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900">{chat.title}</p>
                        </div>
                        <span className="text-xs text-gray-500">{formatTimestamp(chat.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INSIGHTS DE IA - PRIORIDAD #4 */}
        {widgets.aiInsights && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Insights de IA</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <LightBulbIcon className="h-4 w-4" />
                <span>Recomendaciones personalizadas</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recomendaciones */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recomendaciones</h3>
                <div className="space-y-3">
                  {aiInsights.recommendations.map(rec => (
                    <div key={rec.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-xl">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        rec.priority === 'high' ? 'bg-red-500' :
                        rec.priority === 'medium' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}></div>
                      <p className="text-sm text-gray-700">{rec.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tendencias */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencias</h3>
                <div className="space-y-3">
                  {aiInsights.trends.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{trend.metric}</p>
                        <p className="text-lg font-bold text-gray-900">{trend.value}</p>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        trend.trend === 'up' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {trend.trend === 'up' ? (
                          <ArrowTrendingUpIcon className="h-4 w-4" />
                        ) : (
                          <ArrowTrendingDownIcon className="h-4 w-4" />
                        )}
                        <span className="text-sm font-medium">{trend.change}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resúmenes */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resúmenes Automáticos</h3>
                <div className="space-y-3">
                  {aiInsights.summaries.map(summary => (
                    <div key={summary.id} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                      <h4 className="text-sm font-semibold text-purple-900 mb-1">{summary.title}</h4>
                      <p className="text-xs text-purple-700">{summary.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Dashboard