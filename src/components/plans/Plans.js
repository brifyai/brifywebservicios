import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import {
  CheckIcon,
  CreditCardIcon,
  ClockIcon,
  CloudIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const Plans = () => {
  const { user, userProfile, hasActivePlan, updateUserProfile } = useAuth()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(null)

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      setLoading(true)
      const { data, error } = await db.plans.getAll()
      
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

  // Función para crear carpeta administrador en Google Drive
  const createAdminFolder = async (planName) => {
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
      const folderName = `Entrenador - Brify`
      const driveFolder = await googleDriveService.createFolder(folderName)
      
      if (!driveFolder.id) {
        throw new Error('Error creando carpeta en Google Drive')
      }
      
      // Registrar carpeta en base de datos
      const adminFolderData = {
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
      return driveFolder.id
      
    } catch (error) {
      console.error('Error creating admin folder:', error)
      throw error
    }
  }

  const handlePurchasePlan = async (plan) => {
    if (!user) {
      toast.error('Debes iniciar sesión para comprar un plan')
      return
    }

    if (hasActivePlan()) {
      toast.error('Ya tienes un plan activo')
      return
    }

    setProcessingPayment(plan.id)
    
    try {
      // Aquí se integraría con Mercado Pago
      // Por ahora simulamos el proceso de pago
      
      toast.success('Redirigiendo a Mercado Pago...')
      
      // Simular redirección a Mercado Pago
      // En una implementación real, aquí se crearía la preferencia de pago
      const paymentData = {
        user_id: user.id,
        plan_id: plan.id,
        amount_usd: plan.price_usd,
        payment_status: 'pending',
        payment_provider: 'mercadopago',
        payment_ref: `mp_${Date.now()}`,
        paid_at: null
      }
      
      const { error } = await db.payments.create(paymentData)
      
      if (error) {
        console.error('Error creating payment record:', error)
        toast.error('Error procesando el pago')
        return
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
      
      // Simular proceso de pago exitoso después de 2 segundos
      setTimeout(async () => {
        try {
          // Activar plan después del pago exitoso
          const planExpiration = new Date()
          planExpiration.setDate(planExpiration.getDate() + plan.duration_days)
          
          const updateResult = await updateUserProfile({
            current_plan_id: plan.id,
            plan_expiration: planExpiration.toISOString(),
            is_active: true,
            admin: true
          })
          
          if (updateResult.error) {
            console.error('Error activating plan:', updateResult.error)
            toast.error('Pago procesado pero error activando el plan')
          } else {
            toast.success('¡Pago procesado exitosamente! Tu plan se ha activado.')
          }
        } catch (error) {
          console.error('Error activating plan after payment:', error)
          toast.error('Pago procesado pero error activando el plan')
        }
        setProcessingPayment(null)
      }, 2000)
      
    } catch (error) {
      console.error('Error processing payment:', error)
      toast.error('Error procesando el pago')
      setProcessingPayment(null)
    }
  }

  const handleTestPurchase = async (plan) => {
    if (!user) {
      toast.error('Debes iniciar sesión para comprar un plan')
      return
    }

    if (hasActivePlan()) {
      toast.error('Ya tienes un plan activo')
      return
    }

    setProcessingPayment(plan.id)
    
    try {
      toast.success('Iniciando prueba de pago con Mercado Pago...')
      
      // Crear registro de pago de prueba
      const paymentData = {
        user_id: user.id,
        plan_id: plan.id,
        amount_usd: plan.price_usd,
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
        await createAdminFolder(plan.name_es || plan.name)
        toast.dismiss()
        toast.success('¡Plan activado y carpeta creada exitosamente!')
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
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

  const isCurrentPlan = (planCode) => {
    return userProfile?.current_plan_id?.toLowerCase() === planCode?.toLowerCase()
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

  if (loading) {
    return <LoadingSpinner text="Cargando planes..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Elige tu Plan
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Selecciona el plan que mejor se adapte a tus necesidades. 
          Todos los planes incluyen acceso completo a la plataforma.
        </p>
      </div>

      {/* Plan actual */}
      {hasActivePlan() && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 text-green-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-green-800">
                Plan Activo: {getCurrentPlanName()}
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Tu plan está activo y funcionando correctamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {plans.map((plan) => {
          const isProcessing = processingPayment === plan.id
          const isCurrent = isCurrentPlan(plan.id)
          const features = getPlanFeatures(plan.plan_code)
          
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                plan.plan_code?.toLowerCase() === 'premium'
                  ? 'border-gradient-to-r from-yellow-400 to-orange-500 border-yellow-400'
                  : isCurrent
                  ? 'border-green-400'
                  : 'border-gray-200 hover:border-primary-300'
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
                    <span className="text-4xl font-bold text-gray-900">
                      {formatPrice(plan.price_usd)}
                    </span>
                    <span className="text-gray-600 ml-2">/{plan.duration_days} días</span>
                  </div>
                  <p className="text-gray-600">
                    {plan.service_type === 'entrenador' ? 'Plan Entrenador' : plan.service_type}
                  </p>
                </div>

                {/* Características */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center text-sm">
                    <CloudIcon className="h-4 w-4 text-primary-600 mr-3" />
                    <span>Almacenamiento: {formatStorage(plan.storage_limit_bytes)}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <ClockIcon className="h-4 w-4 text-primary-600 mr-3" />
                    <span>Duración: {plan.duration_days} días</span>
                  </div>
                  
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start text-sm">
                      <CheckIcon className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Botón de acción */}
                <div className="text-center">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full bg-green-100 text-green-800 font-semibold py-3 px-6 rounded-lg cursor-not-allowed"
                    >
                      Plan Actual
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchasePlan(plan)}
                      disabled={isProcessing || hasActivePlan()}
                      className={`w-full font-semibold py-3 px-6 rounded-lg transition-all duration-200 ${
                        plan.plan_code?.toLowerCase() === 'premium'
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white'
                          : 'bg-primary-600 hover:bg-primary-700 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isProcessing ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin -ml-1 mr-3 h-5 w-5 text-white">
                            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                          Procesando...
                        </div>
                      ) : hasActivePlan() ? (
                        'Ya tienes un plan activo'
                      ) : (
                        <div className="flex items-center justify-center">
                          <CreditCardIcon className="h-5 w-5 mr-2" />
                          Comprar Plan
                        </div>
                      )}
                    </button>
                  )}
                  
                  {/* Botón de Comprar Prueba */}
                  {!isCurrent && (
                    <button
                      onClick={() => handleTestPurchase(plan)}
                      disabled={isProcessing}
                      className="w-full mt-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          Comprar Prueba
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

      {/* Información adicional */}
      <div className="bg-gray-50 rounded-lg p-6 max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          ¿Tienes preguntas sobre nuestros planes?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Métodos de Pago</h4>
            <p>Aceptamos pagos a través de Mercado Pago, incluyendo tarjetas de crédito, débito y transferencias bancarias.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Soporte</h4>
            <p>Nuestro equipo de soporte está disponible para ayudarte con cualquier pregunta sobre los planes y funcionalidades.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Renovación</h4>
            <p>Los planes se renuevan automáticamente. Puedes cancelar en cualquier momento desde tu perfil.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Garantía</h4>
            <p>Ofrecemos garantía de satisfacción de 7 días. Si no estás satisfecho, te devolvemos tu dinero.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Plans