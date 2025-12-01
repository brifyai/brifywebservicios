import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, db } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import conversationService from '../../services/conversationService'
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
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import ConversationModal from '../common/ConversationModal'
import InsightsIA from './InsightsIA'
import SyncButton from '../drive/SyncButton'
import { SyncService } from '../../services/SyncService'
import toast from 'react-hot-toast'
import { useUserExtensions } from '../../hooks/useUserExtensions'

// Función para formatear bytes de manera estética (máximo GB para evitar números extensos)
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const decimals = 1
  const sizes = ['B', 'KB', 'MB', 'GB']
  
  let i = Math.floor(Math.log(bytes) / Math.log(k))
  
  // Limitar a GB como máximo
  i = Math.min(i, sizes.length - 1)
  
  const value = bytes / Math.pow(k, i)
  
  // Si es MB y el valor es mayor a 1000, convertir a GB
  if (i === 2 && value >= 1000) {
    i = 3 // Cambiar a GB
    const gbValue = bytes / Math.pow(k, 3)
    return parseFloat(gbValue.toFixed(decimals)) + ' ' + sizes[3]
  }
  
  // Para valores enteros, no mostrar decimales
  if (value % 1 === 0) {
    return Math.round(value) + ' ' + sizes[i]
  }
  
  return parseFloat(value.toFixed(decimals)) + ' ' + sizes[i]
}

const Dashboard = () => {
  const { user, userProfile, hasActivePlan, isGoogleDriveConnected } = useAuth()
  const { hasExtension, loading: extensionsLoading } = useUserExtensions()
  // Soporte para distintos nombres posibles de extensiones
  const hasLegalExtension = (
    hasExtension('Chat Legal') ||
    hasExtension('Abogados') ||
    hasExtension('Abogado') ||
    hasExtension('Legal')
  )
  const hasTrainerExtension = (
    hasExtension('Entrenador') ||
    hasExtension('Trainer')
  )
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
  // Eliminado: menú de personalización del dashboard (engranaje oculto)
  const quickActionsRef = useRef(null)

  const scrollQuickActions = (direction) => {
    const el = quickActionsRef.current
    if (!el) return
    const amount = Math.max(300, Math.floor(el.clientWidth * 0.9))
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }
  
  // Estados para métricas en tiempo real
  const [metrics, setMetrics] = useState({
    tokensUsed: 0,
    tokensLimit: 10000,
    documentsProcessed: 0,
    searchesPerformed: 0,
    chatsCreated: 0,
    syncStatus: 'idle',
    systemHealth: 'healthy',
    // Estados dinámicos
    foldersStatus: 'Estable',
    filesStatus: 'Actual',
    storageStatus: 'Óptimo'
  })
  
  // Estados para accesos rápidos
  const [recentDocuments, setRecentDocuments] = useState([])
  const [savedSearches, setSavedSearches] = useState([])
  const [recentChats, setRecentChats] = useState([])
  const [conversaciones, setConversaciones] = useState([])
  
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
  
  // Estado para sincronización Drive
  const [isSyncing, setIsSyncing] = useState(false)
  
  // Estados para funcionalidades de IA
  const [aiInsights, setAiInsights] = useState({
    recommendations: [],
    trends: [],
    summaries: []
  })


  // Estado para el modal de conversaciones
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Onboarding progresivo: Drive, Plan, Chat, Archivos
  const [onboardingProgress, setOnboardingProgress] = useState({
    drive: false,
    plan: false,
    chat: false,
    folders: false,
    status: 'pending'
  })

  // Normaliza el campo completando_primera que puede venir como string, objeto o 'completado'
  const normalizeCompletandoPrimera = (raw) => {
    if (!raw) return null
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (s === 'completado') {
        return { drive: true, plan: true, chat: true, folders: true, status: 'completado' }
      }
      try {
        const parsed = JSON.parse(s)
        if (parsed && typeof parsed === 'object') return parsed
      } catch (e) {
        // Si no es JSON válido, no cambiamos nada
      }
      return null
    }
    if (typeof raw === 'object') {
      // Supabase puede devolver JSONB como objeto
      return raw
    }
    return null
  }

  const initializeOnboardingProgress = () => {
    if (!userProfile) return
    try {
      // Partimos desde el estado actual para evitar resetear pasos ya completados
      let progress = { ...onboardingProgress }
      const normalized = normalizeCompletandoPrimera(userProfile?.completando_primera)
      if (normalized) {
        progress = { ...progress, ...normalized }
      }
      // Baseline según estado real del sistema
      progress.drive = !!(progress.drive || isGoogleDriveConnected)
      progress.plan = !!(progress.plan || hasActivePlan())
      const allDone = progress.drive && progress.plan && progress.chat && progress.folders
      progress.status = allDone ? 'completado' : (progress.status || 'pending')
      setOnboardingProgress(progress)
      setIsNewUser(progress.status !== 'completado')
    } catch (error) {
      console.error('Error initializing onboarding progress:', error)
    }
  }

  // Refrescar desde servidor al ingresar al Dashboard
  const refreshOnboardingFromServer = async () => {
    try {
      if (!user?.id) return
      const { data } = await db.users.getById(user.id)
      const normalized = normalizeCompletandoPrimera(data?.completando_primera)

      let progress = { ...onboardingProgress }
      if (normalized) {
        progress = { ...progress, ...normalized }
      }

      // Aplicar baseline contra estado real
      progress.drive = !!(progress.drive || isGoogleDriveConnected)
      progress.plan = !!(progress.plan || hasActivePlan())
      const allDone = progress.drive && progress.plan && progress.chat && progress.folders
      progress.status = allDone ? 'completado' : (progress.status || 'pending')

      setOnboardingProgress(progress)
      setIsNewUser(progress.status !== 'completado')
    } catch (error) {
      console.error('Error refreshing onboarding from server:', error)
    }
  }

  const persistOnboardingProgress = async (progress) => {
    try {
      await db.users.update(user.id, { completando_primera: JSON.stringify(progress) })
    } catch (error) {
      console.error('Error updating completando_primera:', error)
    }
  }

  const updateOnboardingProgress = async (partial) => {
    // Tomar el estado más reciente desde DB y memoria para evitar regresiones
    let base = { drive: false, plan: false, chat: false, folders: false, status: 'pending' }
    try {
      const normalized = normalizeCompletandoPrimera(userProfile?.completando_primera)
      if (normalized) {
        base = { ...base, ...normalized }
      }
    } catch (err) {
      console.warn('No se pudo leer completando_primera, se usará estado en memoria')
    }

    const merged = { ...base, ...onboardingProgress, ...partial }
    const driveDone = !!(merged.drive || isGoogleDriveConnected)
    const planDone = !!(merged.plan || hasActivePlan())
    const allDone = driveDone && planDone && !!merged.chat && !!merged.folders
    const next = { ...merged, status: allDone ? 'completado' : 'pending' }

    setOnboardingProgress(next)
    setIsNewUser(next.status !== 'completado')
    await persistOnboardingProgress(next)
  }

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
      loadMetrics()
      loadQuickAccessData()
      loadSystemStatus()
      loadAIInsights()
      // Inicializar progreso de onboarding
      initializeOnboardingProgress()
      // Refrescar el progreso desde DB al entrar
      refreshOnboardingFromServer()
    }
  }, [userProfile])

  // No actualizar automáticamente completando_primera por cambios en Drive/Plan.
  // El progreso se persiste sólo al interactuar con botones de Chat y Archivos.

  const loadDashboardData = async () => {
    if (!user || !userProfile) return

    console.log('Dashboard: Starting to load data for user:', user.id)

    try {
      setLoading(true)
      // No modificar isNewUser aquí. Su valor se gestiona
      // mediante initializeOnboardingProgress/updateOnboardingProgress
      // usando el estado real y el campo completando_primera.
      console.log('Dashboard: Data loading completed successfully')
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    try {
      console.log('Cargando métricas reales para usuario:', user.id)
      
      // Cargar uso de tokens real
      const { data: tokenData, error: tokenError } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used')
        .eq('user_id', user.id)
        .single()

      // Cargar el límite de tokens del plan del usuario
      let tokensLimit = 10000 // valor por defecto
      if (userProfile?.current_plan_id) {
        const { data: planData } = await supabase
          .from('plans')
          .select('token_limit_usage')
          .eq('id', userProfile.current_plan_id)
          .single()
        
        if (planData?.token_limit_usage) {
          tokensLimit = planData.token_limit_usage
        }
      }

      // Cargar estadísticas reales de documentos con detalles
      const { data: docStats, error: docError } = await supabase
        .from('documentos_administrador')
        .select('id, name, created_at')
        .eq('administrador', user.email)

      // Contar carpetas reales desde carpetas_usuario y grupos_drive
      let foldersCount = 0
      
      try {
        // Contar carpetas en carpetas_usuario donde el usuario es administrador
        const { data: carpetasUsuario, error: carpetasError } = await supabase
          .from('carpetas_usuario')
          .select('id')
          .eq('administrador', user.email)
        
        if (carpetasError) {
          console.error('Error consultando carpetas_usuario:', carpetasError)
        } else {
          foldersCount += carpetasUsuario?.length || 0
        }
        
        // Contar carpetas en grupos_drive donde el usuario es administrador
        const { data: gruposDrive, error: gruposError } = await supabase
          .from('grupos_drive')
          .select('id')
          .eq('administrador', user.email)
        
        if (gruposError) {
          console.error('Error consultando grupos_drive:', gruposError)
        } else {
          foldersCount += gruposDrive?.length || 0
        }
        
        console.log(`Carpetas encontradas: ${carpetasUsuario?.length || 0} en carpetas_usuario + ${gruposDrive?.length || 0} en grupos_drive = ${foldersCount} total`)
        
      } catch (error) {
        console.error('Error contando carpetas:', error)
        foldersCount = 0
      }

      // Calcular almacenamiento basado en el peso estimado de los registros
      // Cada registro en documentos_administrador ocupa aproximadamente:
      // - UUID (36 chars) + nombre (promedio 50 chars) + metadatos + índices ≈ 2KB por registro
      const BYTES_PER_RECORD = 2048 // 2KB por registro estimado
      const totalStorage = (docStats?.length || 0) * BYTES_PER_RECORD

      // Cargar estadísticas de actividad real si existe la tabla user_activity_stats
      let searchesPerformed = 0
      let chatsCreated = 0
      try {
        const { data: activityData } = await supabase
          .from('user_activity_stats')
          .select('semantic_searches_count, ai_chats_count')
          .eq('user_id', user.id)
          .single()
        
        if (activityData) {
          searchesPerformed = activityData.semantic_searches_count || 0
          chatsCreated = activityData.ai_chats_count || 0
        }
      } catch (activityError) {
        console.log('Tabla user_activity_stats no disponible aún')
      }

      // Calcular estados dinámicos basados en actividad real
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      
      // Estado de Carpetas: basado en carpetas creadas recientemente en ambas tablas
      let foldersStatus = 'Estable'
      try {
        // Verificar carpetas recientes en carpetas_usuario
        const { data: recentCarpetasUsuario } = await supabase
          .from('carpetas_usuario')
          .select('created_at')
          .eq('administrador', user.email)
          .gte('created_at', oneDayAgo.toISOString())
        
        // Verificar carpetas recientes en grupos_drive
        const { data: recentGruposDrive } = await supabase
          .from('grupos_drive')
          .select('created_at')
          .eq('administrador', user.email)
          .gte('created_at', oneDayAgo.toISOString())
        
        const recentFoldersCount = (recentCarpetasUsuario?.length || 0) + (recentGruposDrive?.length || 0)
        
        if (recentFoldersCount > 0) {
          foldersStatus = 'Activo'
        }
        
        console.log(`Carpetas recientes: ${recentFoldersCount} (${recentCarpetasUsuario?.length || 0} + ${recentGruposDrive?.length || 0})`)
        
      } catch (error) {
        console.error('Error calculando estado de carpetas:', error)
        foldersStatus = 'Estable'
      }
      
      // Estado de Archivos: basado en archivos procesados recientemente
      let filesStatus = 'Actual'
      const recentFiles = docStats?.filter(doc =>
        new Date(doc.created_at) > oneHourAgo
      ).length || 0
      if (recentFiles > 0) {
        filesStatus = 'Procesando'
      } else if (docStats?.length === 0) {
        filesStatus = 'Vacío'
      }
      
      // Estado de Almacenamiento: basado en el uso real
      let storageStatus = 'Óptimo'
      const storageMB = totalStorage / (1024 * 1024)
      if (storageMB > 100) {
        storageStatus = 'Alto'
      } else if (storageMB > 500) {
        storageStatus = 'Crítico'
      } else if (storageMB > 10) {
        storageStatus = 'Moderado'
      }

      // Métricas reales con estados dinámicos
      const realMetrics = {
        tokensUsed: tokenData?.tokens_used || 0,
        tokensLimit: tokensLimit,
        documentsProcessed: docStats?.length || 0,
        foldersCount: foldersCount,
        storage: totalStorage,
        searchesPerformed: searchesPerformed,
        chatsCreated: chatsCreated,
        syncStatus: isGoogleDriveConnected ? 'synced' : 'pending',
        systemHealth: 'healthy',
        // Estados dinámicos
        foldersStatus: foldersStatus,
        filesStatus: filesStatus,
        storageStatus: storageStatus
      }

      setMetrics(realMetrics)
      console.log('Métricas reales cargadas:', realMetrics)
      
    } catch (error) {
      console.error('Error loading real metrics:', error)
      // Valores por defecto en caso de error
      setMetrics({
        tokensUsed: 0,
        tokensLimit: 10000,
        documentsProcessed: 0,
        foldersCount: 0,
        storage: 0,
        searchesPerformed: 0,
        chatsCreated: 0,
        syncStatus: 'pending',
        systemHealth: 'healthy',
        // Estados dinámicos por defecto
        foldersStatus: 'Estable',
        filesStatus: 'Actual',
        storageStatus: 'Óptimo'
      })
    }
  }


  const loadQuickAccessData = async () => {
    try {
      // Cargar documentos recientes
      const { data: recentDocs } = await supabase
        .from('documentos_administrador')
        .select('id, name, file_id, created_at')
        .eq('administrador', user.email)
        .order('created_at', { ascending: false })
        .limit(3)

      setRecentDocuments(recentDocs || [])

      // Cargar conversaciones recientes
      const conversacionesRecientes = await conversationService.obtenerConversaciones(user.email)
      setConversaciones(conversacionesRecientes)

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

  const handleConnectGoogleDrive = () => {
    try {
      const authUrl = googleDriveService.generateAuthUrl()
      window.location.href = authUrl
    } catch (error) {
      console.error('Error getting auth URL:', error)
      toast.error('Error al conectar con Google Drive')
    }
  }

  const openGoogleDriveFile = (fileId) => {
    if (fileId) {
      const driveUrl = `https://drive.google.com/file/d/${fileId}/view`
      window.open(driveUrl, '_blank')
    }
  }

  const generarUltimasActividades = () => {
    const actividades = []

    // Agregar documentos recientes como actividades
    recentDocuments.forEach(doc => {
      actividades.push({
        id: `doc-${doc.id}`,
        tipo: 'documento',
        titulo: 'Nuevo documento procesado',
        descripcion: doc.name || `Documento ${doc.id}`,
        fecha: new Date(doc.created_at),
        icono: 'DocumentIcon',
        color: 'blue'
      })
    })

    // Agregar conversaciones como actividades
    conversaciones.forEach((conv, index) => {
      const tipoIcono = conv.tipo === 'Chat General' ? 'ChatBubbleLeftRightIcon' : 
                       conv.tipo === 'Búsqueda Semántica' ? 'MagnifyingGlassIcon' : 
                       'SparklesIcon'
      const color = conv.tipo === 'Chat General' ? 'purple' : 
                   conv.tipo === 'Búsqueda Semántica' ? 'green' : 
                   'yellow'
      
      actividades.push({
        id: `conv-${index}`,
        tipo: 'conversacion',
        titulo: conv.tipo === 'Búsqueda Semántica' ? 'Búsqueda por Texto realizada' : 
               conv.tipo === 'Chat General' ? 'Nueva conversación con IA' : 
               'Consulta con Chat IA',
        descripcion: conv.pregunta.substring(0, 50) + (conv.pregunta.length > 50 ? '...' : ''),
        fecha: new Date(conv.fecha),
        icono: tipoIcono,
        color: color
      })
    })

    // Ordenar por fecha más reciente y tomar solo las 3 más recientes
    return actividades
      .sort((a, b) => b.fecha - a.fecha)
      .slice(0, 3)
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

  // Funciones para el modal de conversaciones
  const handleConversationClick = (conversation) => {
    setSelectedConversation(conversation)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedConversation(null)
  }

  if (loading) {
    return <LoadingSpinner text="Cargando dashboard..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Principal */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
          {/* Versión Desktop - Layout horizontal */}
          <div className="hidden lg:flex lg:items-center lg:justify-between gap-6">
            {/* Sección izquierda - Logo y título */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-black rounded-2xl shadow-lg flex items-center justify-center flex-shrink-0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                  Bienvenido a Brify AI
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  Tu asistente inteligente para gestionar documentos y automatizar procesos
                </p>
              </div>
            </div>
            
            {/* Sección derecha - Estado y botones */}
            <div className="flex items-center gap-3">
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
                <span>Sistema operativo</span>
              </div>
              
              {/* Menú de personalización oculto */}
              
              {/* Botón Telegram */}
              <a
                href="https://t.me/brifybeta_bot"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!hasActivePlan()) {
                    e.preventDefault()
                    toast.error('Debes comprar un plan activo para usar Telegram')
                  }
                }}
                className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-base"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span>Ir a Telegram</span>
              </a>
            </div>
          </div>

          {/* Versión Mobile - Layout vertical mejorado */}
          <div className="lg:hidden space-y-4">
            {/* Fila superior: Logo y título */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-black rounded-2xl shadow-lg flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  Bienvenido a Brify AI
                </h1>
                <p className="text-xs text-gray-600 mt-1">
                  Gestiona documentos con IA
                </p>
              </div>
            </div>
            
            {/* Fila inferior: Estado y botones */}
            <div className="flex items-center justify-between gap-2">
              {/* Estado general del sistema */}
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${
                systemStatus.services.embeddings === 'healthy' &&
                systemStatus.services.groq === 'healthy' &&
                systemStatus.services.drive === 'healthy'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  systemStatus.services.embeddings === 'healthy' &&
                  systemStatus.services.groq === 'healthy' &&
                  systemStatus.services.drive === 'healthy'
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                }`}></div>
                <span>Operativo</span>
              </div>
              
              {/* Contenedor de botones */}
              <div className="flex items-center gap-2">
                {/* Menú de personalización oculto en móvil */}
                
                {/* Botón Telegram */}
                <a
                  href="https://t.me/brifybeta_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!hasActivePlan()) {
                      e.preventDefault()
                      toast.error('Debes comprar un plan activo para usar Telegram')
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xs"
                >
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  <span>Telegram</span>
                </a>
              </div>
            </div>
          </div>

          {/* Versión Tablet - Layout intermedio */}
          <div className="hidden sm:flex lg:hidden flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
            {/* Sección izquierda - Logo y título */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-black rounded-2xl shadow-lg flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  Bienvenido a Brify AI
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Tu asistente inteligente para gestionar documentos y automatizar procesos
                </p>
              </div>
            </div>
            
            {/* Sección derecha - Estado y botones */}
            <div className="flex items-center gap-3">
              {/* Estado general del sistema */}
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                systemStatus.services.embeddings === 'healthy' &&
                systemStatus.services.groq === 'healthy' &&
                systemStatus.services.drive === 'healthy'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  systemStatus.services.embeddings === 'healthy' &&
                  systemStatus.services.groq === 'healthy' &&
                  systemStatus.services.drive === 'healthy'
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                }`}></div>
                <span>Sistema operativo</span>
              </div>
              
              {/* Menú de personalización oculto en tablet */}
              
              {/* Botón Telegram */}
              <a
                href="https://t.me/brifybeta_bot"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!hasActivePlan()) {
                    e.preventDefault()
                    toast.error('Debes comprar un plan activo para usar Telegram')
                  }
                }}
                className="inline-flex items-center px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm"
              >
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span>Ir a Telegram</span>
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
                    onClick={onboardingProgress.drive ? undefined : handleConnectGoogleDrive}
                    disabled={onboardingProgress.drive}
                    className={`w-full font-medium py-2 px-4 rounded-xl transition-colors duration-200 ${onboardingProgress.drive ? 'bg-green-600 text-white cursor-not-allowed' : 'bg-white text-black hover:bg-gray-100'}`}
                  >
                    {onboardingProgress.drive ? (
                      <span className="inline-flex items-center"><CheckCircleIcon className="h-5 w-5 mr-2" /> Conectado</span>
                    ) : (
                      'Conectar Drive'
                    )}
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
                  {onboardingProgress.plan || hasActivePlan() ? (
                    <div className="w-full bg-green-600 text-white font-medium py-2 px-4 rounded-xl inline-block text-center cursor-not-allowed">
                      <span className="inline-flex items-center"><CheckCircleIcon className="h-5 w-5 mr-2" /> Plan activo</span>
                    </div>
                  ) : (
                    <Link
                      to="/plans"
                      className="w-full bg-white text-black font-medium py-2 px-4 rounded-xl hover:bg-gray-100 transition-colors duration-200 inline-block text-center"
                    >
                      Ver Planes
                    </Link>
                  )}
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
                    {onboardingProgress.chat ? (
                      <div className="flex-1 bg-green-600 text-white font-medium py-2 px-3 rounded-lg text-center text-sm cursor-not-allowed">
                        <span className="inline-flex items-center"><CheckCircleIcon className="h-4 w-4 mr-2" /> Chat General</span>
                      </div>
                    ) : (
                      <Link
                        to="/search"
                        onClick={(e) => {
                          if (!hasActivePlan()) {
                            e.preventDefault()
                            toast.error('Debes comprar el plan para acceder al Chat General')
                            return
                          }
                          updateOnboardingProgress({ chat: true })
                        }}
                        className="flex-1 bg-white/10 text-white font-medium py-2 px-3 rounded-lg hover:bg-white/20 transition-colors duration-200 text-center text-sm"
                      >
                        Chat General
                      </Link>
                    )}
                    {onboardingProgress.folders ? (
                      <div className="flex-1 bg-green-600 text-white font-medium py-2 px-3 rounded-lg text-center text-sm cursor-not-allowed">
                        <span className="inline-flex items-center"><CheckCircleIcon className="h-4 w-4 mr-2" /> Archivos</span>
                      </div>
                    ) : (
                      <Link
                        to="/folders"
                        onClick={(e) => {
                          if (!hasActivePlan()) {
                            e.preventDefault()
                            toast.error('Debes comprar el plan para gestionar archivos')
                            return
                          }
                          updateOnboardingProgress({ folders: true })
                        }}
                        className="flex-1 bg-white/10 text-white font-medium py-2 px-3 rounded-lg hover:bg-white/20 transition-colors duration-200 text-center text-sm"
                      >
                        Archivos
                      </Link>
                    )}
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
            
            <div className="relative">
              {/* Flechas de navegación */}
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => scrollQuickActions('left')}
                className="hidden md:flex items-center justify-center absolute -left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full p-2 hover:bg-white"
              >
                <ChevronLeftIcon className="h-5 w-5 text-gray-700" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => scrollQuickActions('right')}
                className="hidden md:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full p-2 hover:bg-white"
              >
                <ChevronRightIcon className="h-5 w-5 text-gray-700" />
              </button>

              <div ref={quickActionsRef} className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1">
              {/* Chat IA - La acción más importante */}
              <Link
                to="/search"
                onClick={(e) => {
                  if (!hasActivePlan()) {
                    e.preventDefault()
                    toast.error('Debes comprar el plan para acceder al Chat General')
                  } else {
                    // Marcar progreso de onboarding al acceder por Acciones Rápidas
                    updateOnboardingProgress({ chat: true })
                  }
                }}
                className="group bg-gradient-to-br from-purple-600 to-purple-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white min-w-[280px] max-w-[280px] snap-start flex-shrink-0"
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
                onClick={(e) => {
                  if (!hasActivePlan()) {
                    e.preventDefault()
                    toast.error('Debes comprar el plan para gestionar archivos')
                  } else {
                    // Marcar progreso de onboarding al acceder por Acciones Rápidas
                    updateOnboardingProgress({ folders: true })
                  }
                }}
                className="group bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white min-w-[280px] max-w-[280px] snap-start flex-shrink-0"
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

              {/* Búsqueda Legal - visible solo si el usuario tiene la extensión (y evitar ocultar durante carga) */}
              {!extensionsLoading && hasLegalExtension && (
                <Link
                  to="/abogado"
                  onClick={(e) => {
                    if (!hasActivePlan()) {
                      e.preventDefault()
                      toast.error('Debes comprar el plan para acceder al Chat Legal')
                    }
                  }}
                  className="group bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white min-w-[280px] max-w-[280px] snap-start flex-shrink-0"
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
              )}

              {/* Entrenador - visible solo si el usuario tiene la extensión (y evitar ocultar durante carga) */}
              {!extensionsLoading && hasTrainerExtension && (
                <Link
                  to="/entrenador"
                  className="group bg-gradient-to-br from-teal-600 to-teal-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white min-w-[280px] max-w-[280px] snap-start flex-shrink-0"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <DocumentTextIcon className="h-8 w-8 text-white" />
                    </div>
                    <ArrowRightIcon className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Couch Deportivo</h3>
                  <p className="text-teal-100 text-sm mb-[35px]">
                    Gestiona rutinas y carpetas de alumnos en una vista dedicada.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-teal-200">Abrir Entrenador</span>
                    <span className="text-xs text-teal-300">Plantilla y rutinas</span>
                  </div>
                </Link>
              )}

              {/* Ver Plan */}
              <Link
                to="/plans"
                className="group bg-gradient-to-br from-orange-600 to-orange-700 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-white min-w-[280px] max-w-[280px] snap-start flex-shrink-0"
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
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[181.5px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm">
                      <CpuChipIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className={`flex items-center text-sm ${
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
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {formatNumber(metrics.tokensUsed)}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">Tokens usados</p>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all duration-300 ${
                          metrics.tokensUsed / metrics.tokensLimit > 0.8 ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min((metrics.tokensUsed / metrics.tokensLimit) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                      Límite: {formatNumber(metrics.tokensLimit)}
                    </p>
                  </div>
                </div>

                {/* Carpetas */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[181.5px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-sm">
                      <FolderOpenIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className={`flex items-center text-sm ${
                      metrics.foldersStatus === 'Activo' ? 'text-green-500' : 'text-yellow-500'
                    }`}>
                      {metrics.foldersStatus === 'Activo' ? (
                        <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                      ) : (
                        <MinusIcon className="h-3 w-3 mr-1" />
                      )}
                      {metrics.foldersStatus}
                    </div>
                  </div>
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {formatNumber(metrics.foldersCount || 0)}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">Carpetas</p>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 justify-center">
                    <CheckCircleIcon className="h-3 w-3 mr-1 text-green-500" />
                    Organizadas
                  </div>
                </div>

                {/* Archivos */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[181.5px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm">
                      <DocumentIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className={`flex items-center text-sm ${
                      metrics.filesStatus === 'Procesando' ? 'text-blue-500' :
                      metrics.filesStatus === 'Vacío' ? 'text-gray-500' : 'text-green-500'
                    }`}>
                      {metrics.filesStatus === 'Procesando' ? (
                        <ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" />
                      ) : metrics.filesStatus === 'Vacío' ? (
                        <MinusIcon className="h-3 w-3 mr-1" />
                      ) : (
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                      )}
                      {metrics.filesStatus}
                    </div>
                  </div>
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {formatNumber(metrics.documentsProcessed)}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">Archivos</p>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 justify-center">
                    <CheckCircleIcon className="h-3 w-3 mr-1 text-green-500" />
                    Todos sincronizados
                  </div>
                </div>

                {/* Almacenamiento */}
                <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm h-[181.5px] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm">
                      <CloudIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className={`flex items-center text-sm ${
                      metrics.storageStatus === 'Crítico' ? 'text-red-500' :
                      metrics.storageStatus === 'Alto' ? 'text-orange-500' :
                      metrics.storageStatus === 'Moderado' ? 'text-yellow-500' : 'text-purple-500'
                    }`}>
                      {metrics.storageStatus === 'Crítico' ? (
                        <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                      ) : metrics.storageStatus === 'Alto' ? (
                        <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                      ) : metrics.storageStatus === 'Moderado' ? (
                        <MinusIcon className="h-3 w-3 mr-1" />
                      ) : (
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                      )}
                      {metrics.storageStatus}
                    </div>
                  </div>
                  <div className="text-center flex-1 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {formatBytes(metrics.storage)}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">Almacenamiento</p>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 justify-center">
                    <CheckCircleIcon className="h-3 w-3 mr-1 text-green-500" />
                    Google Drive
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
              
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm min-h-[231px]">
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
                  
                  <div className={`flex items-center justify-between p-4 rounded-xl ${
                    systemStatus.services.drive === 'disconnected' 
                      ? 'bg-yellow-50 hover:bg-yellow-100 cursor-pointer transition-colors' 
                      : 'bg-gray-50'
                  }`}
                  onClick={systemStatus.services.drive === 'disconnected' ? handleConnectGoogleDrive : undefined}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        systemStatus.services.drive === 'healthy' ? 'bg-green-500' : 
                        systemStatus.services.drive === 'disconnected' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">Google Drive</span>
                    </div>
                    <div className="flex items-center space-x-2">
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
                      {systemStatus.services.drive === 'disconnected' && (
                        <span className="text-xs text-yellow-600 font-medium">
                          Clic para conectar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Botón de Sincronización Drive */}
                {isGoogleDriveConnected && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                    <button
                      onClick={async () => {
                        if (isSyncing) return
                        
                        setIsSyncing(true)
                        setSystemStatus(prev => ({ ...prev, syncInProgress: true }))
                        toast.loading('Iniciando sincronización de Drive...', { id: 'sync-drive' })
                        
                        try {
                          console.log('Iniciando sincronización real de Drive...')
                          
                          // Usar el SyncService real
                          const syncService = new SyncService(user?.email)
                          await syncService.initialize()
                          
                          // Detectar discrepancias
                          const discrepancies = await syncService.detectDiscrepancies()
                          console.log('Discrepancias detectadas:', discrepancies)
                          
                          if (discrepancies && (discrepancies.toAdd?.length > 0 || discrepancies.toRemove?.length > 0 || discrepancies.toUpdate?.length > 0)) {
                            // Construir acciones para aplicar
                            const actions = {
                              addFiles: discrepancies.toAdd || [],
                              removeFiles: discrepancies.toRemove || [],
                              updateFiles: discrepancies.toUpdate || []
                            }
                            
                            // Aplicar sincronización
                            const result = await syncService.applySyncActions(actions)
                            console.log('Resultado de sincronización:', result)
                            
                            if (result && (result.added || result.removed || result.updated)) {
                              toast.success(`Sincronización completada: ${result.added?.length || 0} agregados, ${result.removed?.length || 0} eliminados, ${result.updated?.length || 0} actualizados`, { id: 'sync-drive' })
                            } else {
                              toast.success('Todo está sincronizado. No hay cambios pendientes.', { id: 'sync-drive' })
                            }
                          } else {
                            toast.success('Todo está sincronizado. No hay cambios pendientes.', { id: 'sync-drive' })
                          }
                          
                          // Actualizar última sincronización
                          const now = new Date()
                          setSystemStatus(prev => ({
                            ...prev,
                            lastSync: now,
                            syncInProgress: false
                          }))
                          
                          console.log('Sincronización real completada a las:', now.toISOString())
                          
                        } catch (error) {
                          console.error('Error en sincronización real:', error)
                          toast.error(`Error en la sincronización: ${error.message}`, { id: 'sync-drive' })
                        } finally {
                          setIsSyncing(false)
                          setSystemStatus(prev => ({ ...prev, syncInProgress: false }))
                        }
                      }}
                      disabled={isSyncing}
                      className={`w-full font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center ${
                        isSyncing
                          ? 'bg-blue-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isSyncing ? (
                        <>
                          <div className="animate-spin -ml-1 mr-3 h-4 w-4">
                            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <CloudIcon className="h-4 w-4 mr-2" />
                          Sincronizar Drive
                        </>
                      )}
                    </button>
                  </div>
                )}
                
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
                  {generarUltimasActividades().length > 0 ? (
                    generarUltimasActividades().map(actividad => (
                      <div key={actividad.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                        <div className={`w-10 h-10 bg-${actividad.color}-100 rounded-full flex items-center justify-center`}>
                          {actividad.icono === 'DocumentIcon' && <DocumentIcon className={`h-5 w-5 text-${actividad.color}-600`} />}
                          {actividad.icono === 'ChatBubbleLeftRightIcon' && <ChatBubbleLeftRightIcon className={`h-5 w-5 text-${actividad.color}-600`} />}
                          {actividad.icono === 'MagnifyingGlassIcon' && <MagnifyingGlassIcon className={`h-5 w-5 text-${actividad.color}-600`} />}
                          {actividad.icono === 'SparklesIcon' && <SparklesIcon className={`h-5 w-5 text-${actividad.color}-600`} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{actividad.titulo}</p>
                          <p className="text-xs text-gray-500">{actividad.descripcion}</p>
                        </div>
                        <span className="text-xs text-gray-500">{formatTimestamp(actividad.fecha)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No hay actividades recientes</p>
                    </div>
                  )}
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
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                              <DocumentIcon className="h-3 w-3 text-blue-600" />
                            </div>
                            <p className="text-xs font-medium text-gray-900 truncate max-w-32">
                              {doc.name || `Documento ${doc.id}`}
                            </p>
                          </div>
                          <button
                            onClick={() => openGoogleDriveFile(doc.file_id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Ver en Google Drive"
                          >
                            <EyeIcon className="h-3 w-3 text-gray-400 hover:text-blue-600" />
                          </button>
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
                    {conversaciones.length > 0 ? (
                      conversaciones.map((conv, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all cursor-pointer group"
                          onClick={() => handleConversationClick(conv)}
                        >
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-900 group-hover:text-blue-900">{conv.pregunta.substring(0, 40)}...</p>
                            <p className="text-xs text-gray-500 group-hover:text-blue-600">{conversationService.formatearTipoActividad(conv.tipo)}</p>
                          </div>
                          <span className="text-xs text-gray-500 group-hover:text-blue-600">{formatTimestamp(new Date(conv.fecha))}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-gray-500">No hay conversaciones recientes</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INSIGHTS DE IA - PRIORIDAD #4 */}
        {widgets.aiInsights && (
          <div className="mb-8">
            <InsightsIA />
          </div>
        )}

      </div>

      {/* Modal de Conversación */}
      <ConversationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        conversation={selectedConversation}
      />
    </div>
  )
}

export default Dashboard