import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import {
  CheckIcon,
  CreditCardIcon,
  PlusIcon,
  XMarkIcon,
  StarIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'

const UpgradePlan = ({ isOpen, onClose, currentPlan, userExtensions, onUpgradeComplete }) => {
  const { user, userProfile } = useAuth()
  const [extensions, setExtensions] = useState([])
  const [selectedExtensions, setSelectedExtensions] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAvailableExtensions()
    }
  }, [isOpen, userExtensions])

  const loadAvailableExtensions = async () => {
    try {
      setLoading(true)
      
      // Cargar todas las extensiones disponibles
      const { data: allExtensions, error } = await supabase
        .from('extensiones')
        .select('*')
        .eq('disponible', true)
        .order('price', { ascending: true })

      if (error) {
        console.error('Error loading extensions:', error)
        toast.error('Error cargando las extensiones')
        return
      }

      // Filtrar extensiones que el usuario NO tiene
      const userExtensionIds = userExtensions.map(ue => ue.extension_id)
      const availableForUpgrade = allExtensions.filter(ext => 
        !userExtensionIds.includes(ext.id)
      )

      setExtensions(availableForUpgrade)
    } catch (error) {
      console.error('Error loading extensions:', error)
      toast.error('Error cargando las extensiones')
    } finally {
      setLoading(false)
    }
  }

  const handleExtensionToggle = (extensionId) => {
    setSelectedExtensions(prev => {
      const isSelected = prev.includes(extensionId)
      if (isSelected) {
        return prev.filter(id => id !== extensionId)
      } else {
        return [...prev, extensionId]
      }
    })
  }

  const calculateUpgradePrice = () => {
    return selectedExtensions.reduce((total, extensionId) => {
      const extension = extensions.find(ext => ext.id === extensionId)
      return total + (extension ? parseInt(extension.price) : 0)
    }, 0)
  }

  const formatPrice = (price) => {
    if (price === 0) {
      return '$0 CLP'
    }
    // Formatear precio en CLP con separadores de miles
    return `$${parseInt(price).toLocaleString()} CLP`
  }

  const handleUpgrade = async () => {
    if (selectedExtensions.length === 0) {
      toast.error('Selecciona al menos una extensión para hacer el upgrade')
      return
    }

    if (!user || !currentPlan) {
      toast.error('Error: No se pudo identificar el usuario o plan actual')
      return
    }

    setProcessing(true)

    try {
      // Crear registro de pago para el upgrade
      const upgradePrice = calculateUpgradePrice()
      const paymentData = {
        user_id: user.id,
        plan_id: currentPlan.id,
        amount_usd: upgradePrice,
        payment_status: 'paid', // Para prueba, marcar como pagado
        payment_provider: 'mercadopago_upgrade',
        payment_ref: `upgrade_${Date.now()}`,
        paid_at: new Date().toISOString(),
        description: `Upgrade - Extensiones agregadas al plan ${currentPlan.name_es || currentPlan.name}`
      }

      const { error: paymentError } = await db.payments.create(paymentData)

      if (paymentError) {
        console.error('Error creating upgrade payment record:', paymentError)
        toast.error('Error procesando el pago del upgrade')
        return
      }

      // Agregar las nuevas extensiones al plan del usuario
      const extensionsToInsert = selectedExtensions.map(extensionId => ({
        user_id: user.id,
        plan_id: currentPlan.id,
        extension_id: extensionId,
        created_at: new Date().toISOString()
      }))

      const { error: extensionsError } = await supabase
        .from('plan_extensiones')
        .insert(extensionsToInsert)

      if (extensionsError) {
        console.error('Error adding extensions to plan:', extensionsError)
        toast.error('Error agregando las extensiones al plan')
        return
      }

      // Éxito
      toast.success(`¡Upgrade completado! Se agregaron ${selectedExtensions.length} extensiones a tu plan.`)
      
      // Llamar callback para actualizar la UI padre
      if (onUpgradeComplete) {
        onUpgradeComplete()
      }

      // Cerrar modal
      onClose()

    } catch (error) {
      console.error('Error processing upgrade:', error)
      toast.error('Error procesando el upgrade')
    } finally {
      setProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <ArrowUpIcon className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Upgrade de Plan</h2>
              <p className="text-sm text-gray-600">
                Agrega extensiones a tu plan: {currentPlan?.name_es || currentPlan?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : extensions.length === 0 ? (
            <div className="text-center py-8">
              <StarIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¡Ya tienes todas las extensiones!
              </h3>
              <p className="text-gray-600">
                Tu plan actual incluye todas las extensiones disponibles.
              </p>
            </div>
          ) : (
            <>
              {/* Extensiones disponibles */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Extensiones Disponibles para Agregar
                </h3>
                <div className="space-y-3">
                  {extensions.map((extension) => {
                    const isSelected = selectedExtensions.includes(extension.id)
                    
                    return (
                      <div
                        key={extension.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => handleExtensionToggle(extension.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleExtensionToggle(extension.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {extension.name_es || extension.name}
                                </h4>
                                <span className="text-sm font-bold text-blue-600">
                                  {formatPrice(parseInt(extension.price))}
                                </span>
                              </div>
                              {extension.description_es && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {extension.description_es}
                                </p>
                              )}
                              <div className="flex items-center mt-2 text-xs text-gray-500">
                                <span>Tipo: {extension.type}</span>
                                {extension.storage && (
                                  <span className="ml-4">
                                    Almacenamiento: {extension.storage}
                                  </span>
                                )}
                                {extension.tokens && (
                                  <span className="ml-4">
                                    Tokens: {extension.tokens}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Resumen del upgrade */}
              {selectedExtensions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Resumen del Upgrade
                  </h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <div className="flex justify-between">
                      <span>Extensiones seleccionadas:</span>
                      <span>{selectedExtensions.length}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Precio total del upgrade:</span>
                      <span>{formatPrice(calculateUpgradePrice())}</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    * Este costo se agregará a tu próxima renovación de plan
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpgrade}
                  disabled={selectedExtensions.length === 0 || processing}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedExtensions.length === 0 || processing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {processing ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 text-white">
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
                      Confirmar Upgrade ({formatPrice(calculateUpgradePrice())})
                    </div>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpgradePlan