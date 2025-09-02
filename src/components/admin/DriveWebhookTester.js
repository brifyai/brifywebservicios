// Componente para probar y simular el webhook de Google Drive
// Este componente permite simular las notificaciones que llegarían desde n8n

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DriveNotificationHandler from '../../lib/driveNotificationHandler'
import DriveWatchService from '../../lib/driveWatchService'
import { db } from '../../lib/supabase'
import {
  BellIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const DriveWebhookTester = () => {
  const { user } = useAuth()
  const [watchChannels, setWatchChannels] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [testPayload, setTestPayload] = useState({
    channel_id: '',
    resource_state: 'add',
    resource_id: 'test_resource_' + Date.now(),
    resource_uri: 'https://drive.google.com/file/d/test',
    event_type: 'change',
    folder_id: '',
    changed_files: [
      {
        id: 'file_' + Date.now(),
        name: 'test_document.pdf',
        mimeType: 'application/pdf',
        action: 'added'
      }
    ]
  })

  const notificationHandler = new DriveNotificationHandler()
  const driveWatchService = new DriveWatchService()

  useEffect(() => {
    if (user) {
      loadWatchChannels()
      loadNotifications()
    }
  }, [user])

  const loadWatchChannels = async () => {
    try {
      const result = await DriveWatchService.getUserWatchChannels(user.id)
      const channels = result.success ? result.data : []
      setWatchChannels(channels)
      
      // Si hay canales, usar el primero como default en el payload de prueba
      if (channels.length > 0) {
        setTestPayload(prev => ({
          ...prev,
          channel_id: channels[0].channel_id,
          folder_id: channels[0].folder_id
        }))
      }
    } catch (error) {
      console.error('Error cargando canales de watch:', error)
      toast.error('Error cargando canales de watch')
    }
  }

  const loadNotifications = async () => {
    try {
      const pendingNotifications = await notificationHandler.getPendingNotifications(user.id, 20)
      setNotifications(pendingNotifications)
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    }
  }

  const handleTestWebhook = async () => {
    if (!testPayload.channel_id) {
      toast.error('Selecciona un canal de watch válido')
      return
    }

    setLoading(true)
    try {
      const result = await notificationHandler.simulateWebhookProcessing(testPayload)
      
      if (result.success) {
        toast.success('Webhook procesado exitosamente')
        await loadNotifications() // Recargar notificaciones
      } else {
        toast.error(`Error procesando webhook: ${result.error}`)
      }
      
      console.log('Resultado del webhook:', result)
    } catch (error) {
      console.error('Error en test de webhook:', error)
      toast.error('Error ejecutando test de webhook')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsProcessed = async (notificationIds) => {
    try {
      const result = await notificationHandler.markNotificationsAsProcessed(notificationIds)
      
      if (result.success) {
        toast.success(`${result.updated_count} notificaciones marcadas como procesadas`)
        await loadNotifications()
      } else {
        toast.error(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error marcando notificaciones:', error)
      toast.error('Error marcando notificaciones como procesadas')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <BellIcon className="h-6 w-6 mr-2 text-blue-600" />
          Tester de Webhook Google Drive
        </h2>
        
        {/* Información de canales activos */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Canales de Watch Activos</h3>
          {watchChannels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {watchChannels.map((channel) => (
                <div key={channel.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="text-sm font-medium text-gray-900">Canal: {channel.channel_id}</div>
                  <div className="text-sm text-gray-600">Carpeta: {channel.folder_id}</div>
                  <div className="text-sm text-gray-600">
                    Expira: {channel.expiration ? formatDate(new Date(channel.expiration)) : 'No definido'}
                  </div>
                  <div className="flex items-center mt-2">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      channel.is_active ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className={`text-sm ${
                      channel.is_active ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {channel.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">
              No hay canales de watch activos. Activa un plan para crear canales.
            </div>
          )}
        </div>

        {/* Formulario de test */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Simular Notificación de Webhook</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canal de Watch
              </label>
              <select
                value={testPayload.channel_id}
                onChange={(e) => {
                  const selectedChannel = watchChannels.find(ch => ch.channel_id === e.target.value)
                  setTestPayload(prev => ({
                    ...prev,
                    channel_id: e.target.value,
                    folder_id: selectedChannel?.folder_id || ''
                  }))
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar canal...</option>
                {watchChannels.map((channel) => (
                  <option key={channel.id} value={channel.channel_id}>
                    {channel.channel_id} - {channel.folder_id}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Evento
              </label>
              <select
                value={testPayload.resource_state}
                onChange={(e) => setTestPayload(prev => ({ ...prev, resource_state: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="add">Archivo Agregado</option>
                <option value="remove">Archivo Eliminado</option>
                <option value="update">Archivo Actualizado</option>
                <option value="move">Archivo Movido</option>
                <option value="trash">Archivo a Papelera</option>
                <option value="sync">Sincronización</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Archivo de Prueba
            </label>
            <input
              type="text"
              value={testPayload.changed_files[0]?.name || ''}
              onChange={(e) => setTestPayload(prev => ({
                ...prev,
                changed_files: [{
                  ...prev.changed_files[0],
                  name: e.target.value
                }]
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="documento_test.pdf"
            />
          </div>

          <button
            onClick={handleTestWebhook}
            disabled={loading || !testPayload.channel_id}
            className="btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <ClockIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayIcon className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Procesando...' : 'Simular Webhook'}
          </button>
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Notificaciones Recientes</h3>
          <button
            onClick={loadNotifications}
            className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
          >
            <EyeIcon className="h-4 w-4 mr-1" />
            Actualizar
          </button>
        </div>
        
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        notification.processed 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {notification.processed ? (
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                        ) : (
                          <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                        )}
                        {notification.processed ? 'Procesada' : 'Pendiente'}
                      </span>
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        {notification.resource_state}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Canal: {notification.channel_id}</div>
                      <div>Carpeta: {notification.folder_id}</div>
                      <div>Fecha: {formatDate(notification.created_at)}</div>
                      {notification.changed_files && notification.changed_files.length > 0 && (
                        <div>Archivos: {notification.changed_files.map(f => f.name).join(', ')}</div>
                      )}
                    </div>
                  </div>
                  
                  {!notification.processed && (
                    <button
                      onClick={() => handleMarkAsProcessed([notification.id])}
                      className="ml-4 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Marcar como procesada
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">
            No hay notificaciones recientes
          </div>
        )}
      </div>

      {/* Información del webhook para n8n */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Información para n8n</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>URL del Webhook:</strong> https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135</p>
          <p><strong>Método:</strong> POST</p>
          <p><strong>Formato esperado:</strong> JSON con los campos channel_id, resource_state, resource_id, etc.</p>
          <p className="text-blue-600 mt-3">
            <strong>Nota:</strong> Este componente simula el procesamiento que debería hacer n8n al recibir las notificaciones de Google Drive.
            En producción, n8n recibirá las notificaciones y las procesará usando la función DriveNotificationHandler.
          </p>
        </div>
      </div>
    </div>
  )
}

export default DriveWebhookTester