import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import { toast } from 'react-hot-toast'
import {
  CheckIcon,
  CreditCardIcon,
  XMarkIcon,
  ArrowPathIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'

const RenewalModal = ({ isOpen, onClose, currentPlan, userExtensions, onRenewalComplete }) => {
  const { user, userProfile, updateUserProfile } = useAuth()
  const [extensions, setExtensions] = useState([])
  const [selectedExtensions, setSelectedExtensions] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAvailableExtensions()
      // Pre-seleccionar extensiones que el usuario ya tiene
      if (userExtensions && userExtensions.length > 0) {
        const userExtIds = userExtensions.map(ue => ue.extension_id)
        setSelectedExtensions(userExtIds)
      } else {
        setSelectedExtensions([])
      }
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

      setExtensions(allExtensions || [])
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

  const calculateRenewalPrice = () => {
    const basePrice = currentPlan ? parseInt(currentPlan.price) : 0
    const extensionsPrice = selectedExtensions.reduce((total, extensionId) => {
      const extension = extensions.find(ext => ext.id === extensionId)
      return total + (extension ? parseInt(extension.price) : 0)
    }, 0)
    return basePrice + extensionsPrice
  }

  const formatPrice = (price) => {
    if (price === 0) return '$0 CLP'
    return `$${parseInt(price).toLocaleString()} CLP`
  }

  // Crear subcarpetas faltantes en la carpeta administrador tras agregar extensiones
  const createMissingSubFoldersForSelectedExtensions = async (selectedIds) => {
    try {
      if (!user || !currentPlan) return
      const ids = selectedIds && selectedIds.length ? selectedIds : []
      if (ids.length === 0) return

      // Obtener carpeta administrador
      const { data: adminFolders, error: adminError } = await db.adminFolders.getByEmail(user.email)
      if (adminError && adminError.code !== 'PGRST116') {
        console.error('Error obteniendo carpeta administrador:', adminError)
        return
      }
      if (!adminFolders || adminFolders.length === 0) {
        console.warn('No existe carpeta administrador; se omite creación de subcarpetas de renovación')
        return
      }
      const masterFolderId = adminFolders[0].id_drive_carpeta

      // Configurar tokens de Google Drive
      const { data: credentials } = await db.userCredentials.getByUserId(user.id)
      if (!credentials || (!credentials.google_access_token && !credentials.google_refresh_token)) {
        console.warn('Credenciales de Google Drive no disponibles; no se pueden crear subcarpetas de renovación')
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

      // Subcarpetas existentes
      const { data: existingSubFolders, error: subError } = await db.subCarpetasAdministrador.getByMasterFolderId(masterFolderId)
      if (subError) {
        console.error('Error obteniendo subcarpetas existentes:', subError)
        return
      }
      const existingTipos = new Set((existingSubFolders || []).map(sf => sf.tipo_extension))

      // Mapear extensiones seleccionadas a subcarpetas deseadas
      const desired = []
      for (const extId of ids) {
        const ext = extensions.find(e => e.id === extId) || {}
        const nameLower = (ext.name_es || ext.name || '').toLowerCase()
        const serviceType = (ext.service_type || ext.type || '').toLowerCase()

        // Brify (solo si aplica y no existe)
        if ((serviceType === 'brify' || nameLower.includes('brify')) && !existingTipos.has('brify')) {
          desired.push({ nombre: 'Brify', tipo: 'brify' })
        }
        // Abogados
        if ((nameLower.includes('abogado') || serviceType === 'abogados' || serviceType === 'lawyers') && !existingTipos.has('abogados')) {
          desired.push({ nombre: 'Abogados', tipo: 'abogados' })
        }
        // Entrenador
        if ((nameLower.includes('entrenador') || serviceType === 'entrenador' || serviceType === 'trainer') && !existingTipos.has('entrenador')) {
          desired.push({ nombre: 'Entrenador', tipo: 'entrenador' })
        }
      }

      // Crear las faltantes en Drive y/o registrar si ya existen por nombre (idempotente)
      let driveChildren = []
      try {
        driveChildren = await googleDriveService.listFiles(masterFolderId, 100)
      } catch (e) {
        console.warn('No se pudo listar hijos del master en Drive:', e)
      }

      for (const subFolder of desired) {
        try {
          if (existingTipos.has(subFolder.tipo)) continue

          const existingDriveMatch = Array.isArray(driveChildren)
            ? driveChildren.find(f => f.mimeType === 'application/vnd.google-apps.folder' && (f.name || '').toLowerCase() === subFolder.nombre.toLowerCase())
            : null
          let subFolderId = existingDriveMatch?.id

          if (!subFolderId) {
            const driveSubFolder = await googleDriveService.createFolder(subFolder.nombre, masterFolderId)
            subFolderId = driveSubFolder?.id
          }

          if (subFolderId) {
            const subFolderData = {
              administrador_email: user.email,
              file_id_master: masterFolderId,
              file_id_subcarpeta: subFolderId,
              nombre_subcarpeta: subFolder.nombre,
              tipo_extension: subFolder.tipo
            }
            const { error: subFolderError } = await db.subCarpetasAdministrador.create(subFolderData)
            if (subFolderError) {
              console.error(`Error registrando subcarpeta ${subFolder.nombre}:`, subFolderError)
            } else {
              console.log(`Subcarpeta ${subFolder.nombre} registrada/creada idempotentemente tras renovación`)
              existingTipos.add(subFolder.tipo)
            }
          }
        } catch (e) {
          console.error(`Error creando o registrando subcarpeta faltante ${subFolder.nombre}:`, e)
        }
      }
    } catch (error) {
      console.error('Error creando subcarpetas de renovación:', error)
    }
  }

  const handleRenewal = async () => {
    if (!user || !currentPlan) {
      toast.error('Error: No se pudo identificar el usuario o plan actual')
      return
    }

    setProcessing(true)

    try {
      // Determinar URL de la API: 
      // 1. Usar variable de entorno si existe
      // 2. Si es localhost, usar puerto 3001
      // 3. Si es producción, usar ruta relativa /api/... (asumiendo que se sirve desde el mismo origen)
      let baseUrl;
      if (process.env.REACT_APP_API_URL) {
        baseUrl = process.env.REACT_APP_API_URL;
      } else if (window.location.hostname === 'localhost') {
        baseUrl = 'http://localhost:3001';
      } else {
        baseUrl = ''; // Ruta relativa
      }
      
      const apiUrl = `${baseUrl}/api/create_preference`;

      const items = [
        {
          id: currentPlan.id,
          title: `Renovación Plan ${currentPlan.name_es || currentPlan.name}`,
          description: `Renovación del plan ${currentPlan.name_es || currentPlan.name} por ${currentPlan.duration_days} días`,
          category_id: 'services',
          quantity: 1,
          currency_id: 'CLP',
          unit_price: parseInt(currentPlan.price)
        }
      ]

      // Identificar extensiones nuevas y existentes para cobrarlas
      // En renovación, se cobran TODAS las seleccionadas (renovación de las que tienes + compra de nuevas)
      if (selectedExtensions.length > 0) {
        selectedExtensions.forEach(extId => {
          const extension = extensions.find(e => e.id === extId)
          if (extension) {
            items.push({
              id: extension.id,
              title: `Renovación Extensión: ${extension.name_es || extension.name}`,
              description: extension.description_es || extension.description,
              category_id: 'electronics',
              quantity: 1,
              currency_id: 'CLP',
              unit_price: parseInt(extension.price)
            })
          }
        })
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items,
          payer: {
            name: userProfile?.name || user?.user_metadata?.full_name || 'Usuario',
            email: user.email,
            date_created: new Date().toISOString()
          },
          metadata: {
            user_id: user.id,
            plan_id: currentPlan.id,
            extension_ids: selectedExtensions.join(','),
            type: 'renewal'
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear preferencia de renovación')
      }

      if (data.init_point) {
        toast.success('Redirigiendo a Mercado Pago...')
        window.location.href = data.init_point
      } else {
        throw new Error('No se recibió el link de pago')
      }

    } catch (error) {
      console.error('Error processing renewal:', error)
      toast.error(`Error: ${error.message}`)
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
            <ArrowPathIcon className="h-6 w-6 text-green-600 mr-3" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Renovar Plan</h2>
              <p className="text-sm text-gray-600">
                Plan Actual: {currentPlan?.name_es || currentPlan?.name} ({currentPlan?.duration_days} días)
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
          ) : (
            <>
              {/* Selección de Extensiones */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Configura tu Renovación
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Selecciona las extensiones que deseas mantener o agregar en este nuevo periodo.
                </p>
                <div className="space-y-3">
                  {extensions.map((extension) => {
                    const isSelected = selectedExtensions.includes(extension.id)
                    const isAlreadyOwned = userExtensions.some(ue => ue.extension_id === extension.id)
                    
                    return (
                      <div
                        key={extension.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-green-500 bg-green-50'
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
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {extension.name_es || extension.name}
                                </h4>
                                <span className="text-sm font-bold text-green-600">
                                  {formatPrice(parseInt(extension.price))}
                                </span>
                              </div>
                              {extension.description_es && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {extension.description_es}
                                </p>
                              )}
                              <div className="flex items-center mt-2 text-xs text-gray-500">
                                {isAlreadyOwned && (
                                  <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full mr-2">
                                    Actualmente tienes esta extensión
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

              {/* Resumen de Renovación */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-green-900 mb-2">
                  Resumen de Renovación
                </h4>
                <div className="space-y-1 text-sm text-green-800">
                  <div className="flex justify-between">
                    <span>Precio Base del Plan:</span>
                    <span>{formatPrice(parseInt(currentPlan?.price || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Extensiones seleccionadas ({selectedExtensions.length}):</span>
                    <span>{formatPrice(calculateRenewalPrice() - parseInt(currentPlan?.price || 0))}</span>
                  </div>
                  <div className="border-t border-green-200 my-2 pt-2 flex justify-between font-bold text-lg">
                    <span>Total a Pagar:</span>
                    <span>{formatPrice(calculateRenewalPrice())}</span>
                  </div>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  * Se agregarán {currentPlan?.duration_days} días a tu fecha de vencimiento actual.
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRenewal}
                  disabled={processing}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                    processing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {processing ? (
                    <div className="flex items-center justify-center">
                      <LoadingSpinner className="h-4 w-4 mr-2" />
                      Procesando...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <CreditCardIcon className="h-4 w-4 mr-2" />
                      Pagar y Renovar
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

export default RenewalModal
