import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import googleDriveService from '../../lib/googleDrive'
import DriveWatchService from '../../lib/driveWatchService'
import emailService from '../../lib/emailService'
import { useUserExtensions } from '../../hooks/useUserExtensions'
import { executeQuery } from '../../lib/queryQueue'
import {
  CheckIcon,
  CreditCardIcon,
  ClockIcon,
  CloudIcon,
  StarIcon,
  PlusIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import UpgradePlan from './UpgradePlan'

const Plans = () => {
  const { user, userProfile, hasActivePlan, updateUserProfile } = useAuth()
  const { clearCacheAndRefetch } = useUserExtensions()
  const [plans, setPlans] = useState([])
  const [extensions, setExtensions] = useState([])
  const [selectedExtensions, setSelectedExtensions] = useState({})
  const [userExtensions, setUserExtensions] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(null)
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [currentPlanForUpgrade, setCurrentPlanForUpgrade] = useState(null)
  const [ranEnsureOnce, setRanEnsureOnce] = useState(false)

  useEffect(() => {
    loadPlans()
    loadExtensions()
    if (user) {
      loadUserExtensions()
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Efecto para verificar Google Drive cuando userProfile cambie
  useEffect(() => {
    if (userProfile) {
      checkGoogleDriveConnection()
    }
  }, [userProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reconciliar subcarpetas faltantes al cargar extensiones del usuario (idempotente)
  useEffect(() => {
    const reconcile = async () => {
      if (!user || !isGoogleDriveConnected) return
      if (!userExtensions || userExtensions.length === 0) return
      if (ranEnsureOnce) return
      await ensureAdminSubFoldersForUser()
      setRanEnsureOnce(true)
    }
    reconcile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isGoogleDriveConnected, userExtensions])

  const checkGoogleDriveConnection = () => {
    // Usar la información ya disponible en userProfile desde AuthContext
    // que incluye las credenciales de Google Drive
    const isConnected = !!(userProfile?.google_refresh_token && userProfile.google_refresh_token.trim() !== '')
    setIsGoogleDriveConnected(isConnected)
    console.log('Plans: Google Drive connection status:', isConnected)
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

  const loadPlans = async () => {
    try {
      setLoading(true)
      const { data, error } = await executeQuery(() => db.plans.getAll())
      
      if (error) {
        console.error('Error loading plans:', error)
        toast.error('Error cargando los planes')
        return
      }
      
      setPlans(data || [])
    } catch (error) {
      console.error('Error loading plans:', error)
      toast.error('Error cargando los planes')
    } finally {
      setLoading(false)
    }
  }

  const loadExtensions = async () => {
    try {
      const { data, error } = await executeQuery(() => 
        supabase
          .from('extensiones')
          .select('*')
          .order('created_at', { ascending: true })
      )
      
      if (error) {
        console.error('Error loading extensions:', error)
        toast.error('Error cargando las extensiones')
        return
      }
      
      setExtensions(data || [])
    } catch (error) {
      console.error('Error loading extensions:', error)
      setExtensions([])
      toast.error('Error cargando las extensiones')
    }
  }

  const loadUserExtensions = async () => {
    if (!user) return
    
    try {
      const { data, error } = await executeQuery(() =>
        supabase
          .from('plan_extensiones')
          .select(`
            extension_id,
            plan_id,
            extensiones (
              id,
              name,
              name_es,
              price
            )
          `)
          .eq('user_id', user.id)
      )
      
      if (error) {
        console.error('Error loading user extensions:', error)
        return
      }
      
      setUserExtensions(data || [])
    } catch (error) {
      console.error('Error loading user extensions:', error)
    }
  }

  const handleExtensionToggle = (planId, extensionId) => {
    setSelectedExtensions(prev => {
      const planExtensions = prev[planId] || []
      const isSelected = planExtensions.includes(extensionId)
      
      if (isSelected) {
        return {
          ...prev,
          [planId]: planExtensions.filter(id => id !== extensionId)
        }
      } else {
        return {
          ...prev,
          [planId]: [...planExtensions, extensionId]
        }
      }
    })
  }

  const calculateTotalPrice = (plan) => {
    if (plan.prueba_gratis) {
      return 0
    }
    
    const basePrice = parseInt(plan.price) || 0
    const planExtensions = selectedExtensions[plan.id] || []
    
    const extensionsPrice = planExtensions.reduce((total, extensionId) => {
      const extension = extensions.find(ext => ext.id === extensionId)
      return total + (extension ? parseInt(extension.price) : 0)
    }, 0)
    
    return basePrice + extensionsPrice
  }

  const calculatePriceWithExtensions = (plan) => {
    const basePrice = parseInt(plan.price) || 0
    const planExtensions = selectedExtensions[plan.id] || []
    
    const extensionsPrice = planExtensions.reduce((total, extensionId) => {
      const extension = extensions.find(ext => ext.id === extensionId)
      return total + (extension ? parseInt(extension.price) : 0)
    }, 0)
    
    return basePrice + extensionsPrice
  }

  const formatPrice = (price) => {
    if (price === 0) {
      return '$0 CLP'
    }
    // Formatear precio en CLP con separadores de miles
    return `$${parseInt(price).toLocaleString()} CLP`
  }

  // Función para crear subcarpetas según extensiones
  const createSubFolders = async (masterFolderId, adminEmail, selectedExtensionIds = []) => {
    try {
      const subFoldersToCreate = []
      
      // Siempre crear la carpeta "Brify" (plan básico)
      subFoldersToCreate.push({
        nombre: 'Brify',
        tipo: 'brify'
      })
      
      // Agregar subcarpetas según extensiones seleccionadas
      if (selectedExtensionIds && selectedExtensionIds.length > 0) {
        // Obtener información de las extensiones seleccionadas
        for (const extensionId of selectedExtensionIds) {
          const extension = extensions.find(ext => ext.id === extensionId)
          if (extension) {
            if (extension.name === 'Abogados' || extension.name_es === 'Abogados') {
              subFoldersToCreate.push({
                nombre: 'Abogados',
                tipo: 'abogados'
              })
            }
            if (extension.name === 'Entrenador' || extension.name_es === 'Entrenador') {
              subFoldersToCreate.push({
                nombre: 'Entrenador',
                tipo: 'entrenador'
              })
            }
          }
        }
      }
      
      // Crear cada subcarpeta en Google Drive y registrarla en la base de datos
      for (const subFolder of subFoldersToCreate) {
        try {
          // Crear subcarpeta en Google Drive
          const driveSubFolder = await googleDriveService.createFolder(
            subFolder.nombre,
            masterFolderId // Usar la carpeta Master - Brify como padre
          )
          
          if (driveSubFolder.id) {
            // Registrar subcarpeta en la base de datos
            const subFolderData = {
              administrador_email: adminEmail,
              file_id_master: masterFolderId,
              file_id_subcarpeta: driveSubFolder.id,
              nombre_subcarpeta: subFolder.nombre,
              tipo_extension: subFolder.tipo
            }
            
            const { error: subFolderError } = await db.subCarpetasAdministrador.create(subFolderData)
            
            if (subFolderError) {
              console.error(`Error registrando subcarpeta ${subFolder.nombre}:`, subFolderError)
            } else {
              console.log(`Subcarpeta ${subFolder.nombre} creada exitosamente`)
            }
          }
        } catch (subFolderError) {
          console.error(`Error creando subcarpeta ${subFolder.nombre}:`, subFolderError)
        }
      }
      
    } catch (error) {
      console.error('Error creating subfolders:', error)
      throw error
    }
  }

  // Helper idempotente: asegura que existan las subcarpetas para extensiones actuales del usuario
  const ensureAdminSubFoldersForUser = async () => {
    try {
      if (!user) return

      // Obtener la carpeta administrador existente
      const { data: adminFolders, error: adminError } = await db.adminFolders.getByEmail(user.email)
      if (adminError && adminError.code !== 'PGRST116') {
        console.error('Error obteniendo carpeta admin:', adminError)
        return
      }
      if (!adminFolders || adminFolders.length === 0) {
        console.warn('No existe carpeta administrador para el usuario, se omite creación de subcarpetas')
        return
      }

      const masterFolderId = adminFolders[0].id_drive_carpeta

      // Cargar credenciales de Google Drive y configurar servicio
      const { data: credentials } = await db.userCredentials.getByUserId(user.id)
      if (!credentials || !credentials.google_access_token) {
        console.warn('Credenciales de Google Drive no disponibles, no se pueden crear subcarpetas')
        return
      }
      const tokensOk = await googleDriveService.setTokens({
        access_token: credentials.google_access_token,
        refresh_token: credentials.google_refresh_token
      })
      if (!tokensOk) {
        console.warn('No se pudieron configurar tokens de Google Drive')
        return
      }

      // Obtener subcarpetas existentes registradas en BD
      const { data: existingSubFolders, error: subError } = await db.subCarpetasAdministrador.getByMasterFolderId(masterFolderId)
      if (subError) {
        console.error('Error obteniendo subcarpetas existentes:', subError)
        return
      }
      const existingTipos = new Set((existingSubFolders || []).map(sf => sf.tipo_extension))

      // Construir lista deseada a partir de extensiones del usuario
      const desired = []
      // Siempre asegurar Brify
      if (!existingTipos.has('brify')) {
        desired.push({ nombre: 'Brify', tipo: 'brify' })
      }
      // Extensiones del usuario
      const userExts = userExtensions || []
      for (const ue of userExts) {
        const ext = ue.extensiones || {}
        const name = (ext.name_es || ext.name || '').toLowerCase()
        const type = (ext.type || '').toLowerCase()
        // Abogados
        if ((name === 'abogados' || type === 'abogados' || type === 'lawyers') && !existingTipos.has('abogados')) {
          desired.push({ nombre: 'Abogados', tipo: 'abogados' })
        }
        // Entrenador
        if ((name === 'entrenador' || type === 'entrenador' || type === 'trainer') && !existingTipos.has('entrenador')) {
          desired.push({ nombre: 'Entrenador', tipo: 'entrenador' })
        }
      }

      // Crear las faltantes
      for (const subFolder of desired) {
        try {
          const driveSubFolder = await googleDriveService.createFolder(subFolder.nombre, masterFolderId)
          if (driveSubFolder.id) {
            const subFolderData = {
              administrador_email: user.email,
              file_id_master: masterFolderId,
              file_id_subcarpeta: driveSubFolder.id,
              nombre_subcarpeta: subFolder.nombre,
              tipo_extension: subFolder.tipo
            }
            const { error: subFolderError } = await db.subCarpetasAdministrador.create(subFolderData)
            if (subFolderError) {
              console.error(`Error registrando subcarpeta ${subFolder.nombre}:`, subFolderError)
            } else {
              console.log(`Subcarpeta ${subFolder.nombre} creada exitosamente tras upgrade/renovación`)
            }
          }
        } catch (e) {
          console.error(`Error creando subcarpeta faltante ${subFolder.nombre}:`, e)
        }
      }
    } catch (e) {
      console.error('Error asegurando subcarpetas de extensiones:', e)
    }
  }

  // Función para crear carpeta administrador en Google Drive
  const createAdminFolder = async (planName, planId = null) => {
    try {
      // Verificar si ya existe una carpeta administrador para este usuario
      const { data: existingFolder, error: checkError } = await db.adminFolders.getByEmail(user.email)
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking existing admin folder:', checkError)
        throw new Error('Error verificando carpeta existente')
      }
      
      if (existingFolder && existingFolder.length > 0) {
        console.log('Admin folder already exists:', existingFolder[0])
        return existingFolder[0].id_drive_carpeta
      }
      
      // Crear carpeta en Google Drive
      const folderName = `Master - Brify`
      const driveFolder = await googleDriveService.createFolder(folderName)
      
      if (!driveFolder.id) {
        throw new Error('Error creando carpeta en Google Drive')
      }
      
      // Registrar carpeta en base de datos
      const adminFolderData = {
        user_id: user.id,
        correo: user.email,
        id_drive_carpeta: driveFolder.id,
        plan_name: planName,
        telegram_id: userProfile?.telegram_id || null
      }
      
      const { data: savedFolder, error: saveError } = await db.adminFolders.create(adminFolderData)
      
      if (saveError) {
        console.error('Error saving admin folder to database:', saveError)
        // Intentar eliminar la carpeta de Google Drive si falló el guardado
        try {
          await googleDriveService.deleteFile(driveFolder.id)
        } catch (deleteError) {
          console.error('Error deleting folder after save failure:', deleteError)
        }
        throw new Error('Error guardando carpeta en base de datos')
      }
      
      console.log('Admin folder created successfully:', savedFolder)
      
      // Crear subcarpetas según extensiones del usuario
      try {
        // Obtener extensiones seleccionadas para este plan (si las hay)
        const planExtensions = selectedExtensions[planId] || []
        await createSubFolders(driveFolder.id, user.email, planExtensions)
        console.log('Subcarpetas creadas exitosamente')
      } catch (subFoldersError) {
        console.error('Error creando subcarpetas:', subFoldersError)
        // No lanzar error ya que la carpeta principal se creó exitosamente
      }
      
      // Configurar watch channel para la carpeta administrador
      try {
        const { data: credentials } = await db.userCredentials.getByUserId(user.id)
        if (credentials && credentials.google_access_token) {
          await DriveWatchService.createWatchChannel(
            user.id,
            driveFolder.id,
            credentials.google_access_token
          )
          console.log('Watch channel configurado exitosamente para carpeta administrador')
        } else {
          console.warn('No se pudo configurar watch channel: credenciales no disponibles')
        }
      } catch (watchError) {
        console.error('Error configurando watch channel:', watchError)
        // No lanzar error ya que la carpeta se creó exitosamente
      }
      
      return driveFolder.id
      
    } catch (error) {
      console.error('Error creating admin folder:', error)
      throw error
    }
  }

  const handleTestPurchase = async (plan) => {
    if (!user) {
      toast.error('Debes iniciar sesión para comprar un plan')
      return
    }

    if (!isGoogleDriveConnected) {
      toast.error('Debes vincular tu cuenta de Google Drive antes de comprar un plan.')
      return
    }

    // Permitir comprar pruebas incluso si ya tiene un plan activo
    // if (hasActivePlan()) {
    //   toast.error('Ya tienes un plan activo')
    //   return
    // }

    setProcessingPayment(plan.id)
    
    try {
      toast.success('Iniciando prueba de pago con Mercado Pago...')
      
      // Crear registro de pago de prueba
      const paymentData = {
        user_id: user.id,
        plan_id: plan.id,
        amount_usd: calculateTotalPrice(plan),
        payment_status: 'paid', // Marcar como completado para prueba
        payment_provider: 'mercadopago_test',
        payment_ref: `test_mp_${Date.now()}`,
        paid_at: new Date().toISOString()
      }
      
      const { error: paymentError } = await db.payments.create(paymentData)
      
      if (paymentError) {
        console.error('Error creating test payment record:', paymentError)
        toast.error('Error procesando el pago de prueba')
        setProcessingPayment(null)
        return
      }
      
      // Activar plan de prueba
      const planExpiration = new Date()
      planExpiration.setDate(planExpiration.getDate() + plan.duration_days)
      
      const updateResult = await updateUserProfile({
        current_plan_id: plan.id,
        plan_expiration: planExpiration.toISOString(),
        is_active: true,
        admin: true
      })
      
      if (updateResult.error) {
        console.error('Error activating test plan:', updateResult.error)
        toast.error('Error activando el plan de prueba')
        setProcessingPayment(null)
        return
      }
      
      // Guardar extensiones seleccionadas en plan_extensiones
      try {
        const selectedExtensionIds = selectedExtensions[plan.id] || []
        
        if (selectedExtensionIds.length > 0) {
          const extensionsToInsert = selectedExtensionIds.map(extensionId => ({
            user_id: user.id,
            plan_id: plan.id,
            extension_id: extensionId,
            created_at: new Date().toISOString()
          }))
          
          const { error: extensionsError } = await supabase
            .from('plan_extensiones')
            .insert(extensionsToInsert)
          
          if (extensionsError) {
            console.error('Error guardando extensiones:', extensionsError)
          } else {
            console.log(`Guardadas ${selectedExtensionIds.length} extensiones para el plan de prueba`)
          }
        }
      } catch (extensionError) {
        console.error('Error guardando extensiones:', extensionError)
        // No mostrar error al usuario ya que el plan se activó correctamente
      }
      
      // Crear o actualizar registro en user_tokens_usage con el límite del plan
      try {
        const { error: tokenError } = await db.userTokensUsage.upsert({
          user_id: user.id,
          total_tokens: plan.token_limit_usage || 0,
          last_updated_at: new Date().toISOString()
        })
        
        if (tokenError) {
          console.error('Error creating token usage record:', tokenError)
        }
      } catch (tokenError) {
        console.error('Error with token usage setup:', tokenError)
      }
      
      // Verificar conexión a Google Drive antes de crear carpeta
      const { data: credentials } = await db.userCredentials.getByUserId(user.id)
      
      if (!credentials || !credentials.google_access_token) {
        toast.error('Debes conectar Google Drive antes de activar el plan')
        setProcessingPayment(null)
        return
      }
      
      // Configurar tokens en Google Drive service
      googleDriveService.setTokens({
        access_token: credentials.google_access_token,
        refresh_token: credentials.google_refresh_token
      })
      
      try {
        // Crear carpeta administrador en Google Drive
        toast.loading('Creando carpeta en Google Drive...')
        await createAdminFolder(plan.name_es || plan.name, plan.id)
        toast.dismiss()
        toast.success('¡Plan activado y carpeta creada exitosamente!')
        
        // Recargar datos del usuario para actualizar la UI
        setTimeout(() => {
          window.location.reload()
        }, 1000)
        
        // Enviar correo de bienvenida post-compra con todas las funcionalidades
        try {
          const planName = plan.name_es || plan.name || 'Plan de Prueba'
          const userName = userProfile?.name || user?.user_metadata?.full_name || 'Usuario'
          
          await emailService.sendPostPurchaseWelcomeEmail(
            user.email, 
            userName, 
            planName,
            user.id
          )
          console.log('Correo post-compra enviado exitosamente')
        } catch (emailError) {
          console.error('Error enviando correo post-compra:', emailError)
          // No mostrar error al usuario ya que el plan se activó correctamente
        }
      } catch (folderError) {
        console.error('Error creating admin folder:', folderError)
        toast.dismiss()
        toast.error(`Plan activado, pero error creando carpeta: ${folderError.message}`)
      }
      
      setProcessingPayment(null)
      
    } catch (error) {
      console.error('Error processing test payment:', error)
      toast.error('Error procesando el pago de prueba')
      setProcessingPayment(null)
    }
  }

  const formatStorage = (bytes) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
    }
    return `${bytes} Bytes`
  }

  const getPlanFeatures = (planCode) => {
    const features = {
      basic: [
        'Almacenamiento: 1 GB',
        'Hasta 10 carpetas',
        'Hasta 100 archivos',
        'Soporte por email',
        'Embeddings básicos'
      ],
      pro: [
        'Almacenamiento: 5 GB',
        'Hasta 50 carpetas',
        'Hasta 1,000 archivos',
        'Soporte prioritario',
        'Embeddings avanzados',
        'API access'
      ],
      premium: [
        'Almacenamiento: 20 GB',
        'Carpetas ilimitadas',
        'Archivos ilimitados',
        'Soporte 24/7',
        'Embeddings premium',
        'API access completo',
        'Análisis avanzado'
      ]
    }
    
    return features[planCode?.toLowerCase()] || []
  }

  const isCurrentPlan = (planId) => {
    return userProfile?.current_plan_id === planId
  }

  const getCurrentPlanName = () => {
    if (!userProfile?.current_plan_id) return 'Sin plan'
    const currentPlan = plans.find(plan => plan.id === userProfile.current_plan_id)
    return currentPlan ? (currentPlan.name_es || currentPlan.name) : 'Plan no encontrado'
  }

  const getPlanBadge = (planCode) => {
    if (planCode?.toLowerCase() === 'premium') {
      return (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center">
            <StarIcon className="h-3 w-3 mr-1" />
            Más Popular
          </span>
        </div>
      )
    }
    return null
  }

  const handleOpenUpgrade = (plan) => {
    setCurrentPlanForUpgrade(plan)
    setShowUpgradeModal(true)
  }

  const handleCloseUpgrade = () => {
    setShowUpgradeModal(false)
    setCurrentPlanForUpgrade(null)
  }

  const handleUpgradeComplete = async () => {
    // Limpiar caché y recargar extensiones del usuario para actualizar la UI
    await clearCacheAndRefetch()
    // Recargar también las extensiones locales
    await loadUserExtensions()
    // Crear subcarpetas faltantes según extensiones actuales del usuario
    await ensureAdminSubFoldersForUser()
    // Cerrar modal
    setShowUpgradeModal(false)
    setCurrentPlanForUpgrade(null)
  }

  const getAvailableExtensionsCount = () => {
    if (!extensions.length || !userExtensions.length) return 0
    
    const userExtensionIds = userExtensions.map(ue => ue.extension_id)
    const availableExtensions = extensions.filter(ext => 
      ext.disponible && !userExtensionIds.includes(ext.id)
    )
    
    return availableExtensions.length
  }

  if (loading) {
    return <LoadingSpinner text="Cargando planes..." />
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
                  Planes y Suscripciones
                </h1>
                <p className="text-gray-600 mt-1">
                  Elige el plan perfecto para tus necesidades
                </p>
              </div>
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Alerta Google Drive no conectado */}
        {!isGoogleDriveConnected && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-xl mr-4">
                  <CloudIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">
                    Google Drive no conectado
                  </h3>
                  <p className="text-blue-700 mt-1">
                    Debes conectar tu cuenta de Google Drive para poder comprar planes y usar todas las funcionalidades.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnectGoogleDrive}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                Conectar Drive
              </button>
            </div>
          </div>
        )}

        {/* Plan actual */}
        {hasActivePlan() && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-2xl p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-xl mr-4">
                <CheckIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-900">
                  Plan Activo: {getCurrentPlanName()}
                </h3>
                <p className="text-green-700 mt-1">
                  Tu plan está activo y funcionando correctamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Planes Disponibles */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Elige tu Plan
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Selecciona el plan que mejor se adapte a tus necesidades. 
              Todos los planes incluyen acceso completo a la plataforma.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const isProcessing = processingPayment === plan.id
              const isCurrent = isCurrentPlan(plan.id)
              const features = getPlanFeatures(plan.plan_code)
              
              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-3xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                    plan.plan_code?.toLowerCase() === 'premium'
                      ? 'border-gradient-to-r from-yellow-400 to-orange-500 border-yellow-400'
                      : isCurrent
                      ? 'border-green-400'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {getPlanBadge(plan.plan_code)}
                  
                  <div className="p-8">
                    {/* Header del plan */}
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {plan.name_es || plan.name}
                      </h3>
                      <div className="flex items-center justify-center mb-4">
                        {plan.prueba_gratis ? (
                          <div className="flex flex-col items-center">
                            {calculatePriceWithExtensions(plan) > parseInt(plan.price) ? (
                              <span className="text-2xl font-bold text-gray-400 line-through">
                                {formatPrice(calculatePriceWithExtensions(plan))}
                              </span>
                            ) : (
                              <span className="text-2xl font-bold text-gray-400 line-through">
                                {formatPrice(parseInt(plan.price))}
                              </span>
                            )}
                            <span className="text-4xl font-bold text-green-600">
                              $0
                            </span>
                            <span className="text-xs text-green-600 font-medium">
                              PRUEBA GRATIS
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-4xl font-bold text-gray-900">
                              {formatPrice(calculateTotalPrice(plan))}
                            </span>
                            {calculateTotalPrice(plan) !== parseInt(plan.price) && (
                              <span className="text-sm text-gray-500">
                                Base: {formatPrice(parseInt(plan.price))}
                              </span>
                            )}
                          </div>
                        )}
                        <span className="text-gray-600 ml-2">/{plan.duration_days} días</span>
                      </div>
                      <p className="text-gray-600">
                        {plan.service_type === 'entrenador' ? 'Plan Entrenador' : plan.service_type}
                      </p>
                    </div>

                    {/* Características */}
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center text-sm">
                        <CloudIcon className="h-4 w-4 text-blue-600 mr-3" />
                        <span>Almacenamiento: {formatStorage(plan.storage_limit_bytes)}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <ClockIcon className="h-4 w-4 text-blue-600 mr-3" />
                        <span>Duración: {plan.duration_days} días</span>
                      </div>
                      
                      {features.map((feature, index) => (
                        <div key={index} className="flex items-start text-sm">
                          <CheckIcon className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Extensiones */}
                    {extensions.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Extensiones Disponibles
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {extensions.map((extension) => {
                            const isSelected = (selectedExtensions[plan.id] || []).includes(extension.id)
                            const isAvailable = extension.disponible
                            const isPurchased = userExtensions.some(ue => ue.extension_id === extension.id)
                            
                            return (
                              <div
                                key={extension.id}
                                className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                                  isPurchased
                                    ? 'bg-green-50 border-green-200'
                                    : !isAvailable
                                    ? 'bg-gray-50 border-gray-200 opacity-60'
                                    : isSelected
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex items-center flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isPurchased || isSelected}
                                    disabled={!isAvailable || isPurchased}
                                    onChange={() => handleExtensionToggle(plan.id, extension.id)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                  />
                                  <div className="ml-3 flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className={`text-xs font-medium ${
                                        isPurchased ? 'text-green-700' :
                                        !isAvailable ? 'text-gray-400 line-through' : 'text-gray-900'
                                      }`}>
                                        {extension.name_es}
                                      </span>
                                      <span className={`text-xs font-bold ${
                                        isPurchased ? 'text-green-600' :
                                        !isAvailable ? 'text-gray-400 line-through' : 'text-blue-600'
                                      }`}>
                                        {isPurchased ? 'COMPRADA' : `+${formatPrice(parseInt(extension.price))}`}
                                      </span>
                                    </div>
                                    {extension.description_es && (
                                      <p className={`text-xs mt-1 ${
                                        isPurchased ? 'text-green-600' :
                                        !isAvailable ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                        {extension.description_es}
                                      </p>
                                    )}
                                    {isPurchased && (
                                      <p className="text-xs text-green-600 mt-1 font-medium">
                                        ✓ Extensión activa
                                      </p>
                                    )}
                                    {!isAvailable && !isPurchased && (
                                      <p className="text-xs text-red-500 mt-1">
                                        No disponible
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Botón de acción */}
                    <div className="text-center">
                      {isCurrent ? (
                        <div className="space-y-3">
                          <button
                            disabled
                            className="w-full bg-green-100 text-green-800 font-semibold py-3 px-6 rounded-xl cursor-not-allowed"
                          >
                            Plan Actual
                          </button>
                          {getAvailableExtensionsCount() > 0 && (
                            <button
                              onClick={() => handleOpenUpgrade(plan)}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                              <div className="flex items-center justify-center">
                                <ArrowUpIcon className="h-4 w-4 mr-2" />
                                Upgrade Plan ({getAvailableExtensionsCount()} extensiones disponibles)
                              </div>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          disabled
                          className="w-full font-semibold py-3 px-6 rounded-xl transition-all duration-200 bg-gray-400 text-gray-600 cursor-not-allowed opacity-60"
                        >
                          <div className="flex items-center justify-center">
                            <CreditCardIcon className="h-5 w-5 mr-2" />
                            Comprar Plan
                          </div>
                        </button>
                      )}
                      
                      {/* Botón de Comprar Prueba */}
                      {!isCurrent && (
                        <button
                          onClick={() => handleTestPurchase(plan)}
                          disabled={!isGoogleDriveConnected || isProcessing}
                          className={`w-full mt-3 font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg ${
                            !isGoogleDriveConnected
                              ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                              : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
                          }`}
                        >
                          {isProcessing ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin -ml-1 mr-3 h-4 w-4 text-white">
                                <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              </div>
                              Procesando...
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <CreditCardIcon className="h-4 w-4 mr-2" />
                              {!isGoogleDriveConnected ? 'Conecta Google Drive' : 'Comenzar Prueba'}
                            </div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Información adicional */}
        <div className="bg-gray-50 rounded-3xl p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            ¿Tienes preguntas sobre nuestros planes?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <CreditCardIcon className="h-5 w-5 mr-2 text-blue-600" />
                Métodos de Pago
              </h4>
              <p>Aceptamos pagos a través de Mercado Pago, incluyendo tarjetas de crédito, débito y transferencias bancarias.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <CheckIcon className="h-5 w-5 mr-2 text-green-600" />
                Soporte
              </h4>
              <p>Nuestro equipo de soporte está disponible para ayudarte con cualquier pregunta sobre los planes y funcionalidades.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <ClockIcon className="h-5 w-5 mr-2 text-purple-600" />
                Renovación
              </h4>
              <p>Los planes se renuevan automáticamente. Puedes cancelar en cualquier momento desde tu perfil.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <CheckIcon className="h-5 w-5 mr-2 text-orange-600" />
                Garantía
              </h4>
              <p>Ofrecemos garantía de satisfacción de 7 días. Si no estás satisfecho, te devolvemos tu dinero.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Upgrade */}
      <UpgradePlan
        isOpen={showUpgradeModal}
        onClose={handleCloseUpgrade}
        currentPlan={currentPlanForUpgrade}
        userExtensions={userExtensions}
        onUpgradeComplete={handleUpgradeComplete}
      />
    </div>
  )
}

export default Plans