import React, { useState, useEffect, useRef } from 'react'
import { 
  CloudIcon,
  CloudArrowUpIcon, 
  CloudArrowDownIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import googleDriveService from '../../lib/googleDrive'
import { SyncService } from '../../services/SyncService'
import toast from 'react-hot-toast'

const SyncButton = ({ userEmail, onSyncComplete }) => {
  const [syncStatus, setSyncStatus] = useState('idle') // idle, syncing, success, error
  const [syncMessage, setSyncMessage] = useState('')
  const [syncStats, setSyncStats] = useState({ added: 0, modified: 0, deleted: 0 })
  const componentRef = useRef()

  const handleSync = async () => {
    if (syncStatus === 'syncing') return

    // Validar que tenemos el userEmail antes de proceder
    if (!userEmail) {
      setSyncStatus('error')
      setSyncMessage('Error: Email del usuario no disponible. Por favor, recarga la página.')
      return
    }

    setSyncStatus('syncing')
    setSyncMessage('Iniciando sincronización...')
    setSyncStats({ added: 0, modified: 0, deleted: 0 })

    try {
      console.log('Iniciando sincronización para usuario:', userEmail)
      const syncService = new SyncService(userEmail)
      
      // Inicializar el servicio
      setSyncMessage('Cargando configuración de carpetas...')
      await syncService.initialize()

      // Obtener estadísticas antes de la sincronización
      setSyncMessage('Analizando diferencias...')
      const stats = await syncService.getSyncStats()
      setSyncStats(stats)

      if (stats.totalDiscrepancies === 0) {
        setSyncStatus('success')
        setSyncMessage('Todo está sincronizado. No hay cambios pendientes.')
        if (onSyncComplete) onSyncComplete(stats)
        return
      }

      // Detectar discrepancias para obtener las acciones necesarias
      setSyncMessage(`Detectando cambios...`)
      const discrepancies = await syncService.detectDiscrepancies()
      
      // Construir el objeto de acciones para applySyncActions
      const actions = {
        addFiles: discrepancies.toAdd || [],
        removeFiles: discrepancies.toRemove || [],
        updateFiles: discrepancies.toUpdate || []
      }

      // Realizar la sincronización
      setSyncMessage(`Sincronizando ${stats.totalDiscrepancies} cambios...`)
      const result = await syncService.applySyncActions(actions)

      if (result && result.added && result.removed && result.updated) {
        setSyncStatus('success')
        setSyncMessage(`Sincronización completada exitosamente. ${result.added.length + result.removed.length + result.updated.length} cambios aplicados.`)
      } else {
        setSyncStatus('error')
        setSyncMessage(`Error en la sincronización: ${result?.error || 'Error desconocido'}`)
      }

      if (onSyncComplete) onSyncComplete(result)

    } catch (error) {
      console.error('Error durante la sincronización:', error)
      setSyncStatus('error')
      setSyncMessage(`Error: ${error.message}`)
    }
  }

  useEffect(() => {
    // Exponer la función handleSync al DOM para que pueda ser llamada desde el Dashboard
    if (componentRef.current) {
      componentRef.current._syncHandler = handleSync
    }
  }, [])

  // Función para obtener el color del estado
  const getStatusColor = () => {
    switch (syncStatus) {
      case 'syncing': return '#fbbf24' // amarillo
      case 'success': return '#10b981' // verde
      case 'error': return '#ef4444' // rojo
      default: return '#6b7280' // gris
    }
  }

  // Función para obtener el icono del estado
  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing': return '🔄'
      case 'success': return '✅'
      case 'error': return '❌'
      default: return '📁'
    }
  }

  // Función para obtener el icono según el estado
  const renderIcon = () => {
    if (syncStatus === 'syncing') {
      return <ArrowPathIcon className="h-5 w-5 text-primary-600 mr-3 animate-spin" />
    } else if (syncStatus === 'success') {
      return <CheckCircleIcon className="h-5 w-5 text-green-600 mr-3" />
    } else if (syncStatus === 'error') {
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-3" />
    } else {
      return <CloudIcon className="h-5 w-5 text-primary-600 mr-3" />
    }
  }

  // Función para obtener el texto según el estado
  const getButtonText = () => {
    if (syncStatus === 'syncing') {
      return 'Sincronizando...'
    } else if (syncStatus === 'success') {
      return 'Sincronización Completa'
    } else if (syncStatus === 'error') {
      return 'Error en Sincronización'
    } else {
      return 'Sincronizar Drive'
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncStatus === 'syncing'}
      className={`flex items-center p-3 rounded-lg border transition-colors duration-200 w-full ${
        syncStatus === 'syncing' 
          ? 'border-yellow-200 bg-yellow-50 cursor-not-allowed' 
          : syncStatus === 'success'
          ? 'border-green-200 bg-green-50 hover:bg-green-100'
          : syncStatus === 'error'
          ? 'border-red-200 bg-red-50 hover:bg-red-100'
          : 'border-gray-200 hover:bg-gray-50'
      }`}
      title={syncStatus === 'syncing' ? syncMessage : `Cambios: ${syncStats.added} nuevos, ${syncStats.modified} modificados, ${syncStats.deleted} eliminados`}
    >
      {renderIcon()}
      <span className={`text-sm font-medium ${
        syncStatus === 'success' 
          ? 'text-green-900' 
          : syncStatus === 'error'
          ? 'text-red-900'
          : 'text-gray-900'
      }`}>
        {getButtonText()}
      </span>
    </button>
  )
}

export default SyncButton