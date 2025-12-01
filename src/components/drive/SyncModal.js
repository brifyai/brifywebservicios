import React, { useState } from 'react'
import { X, Plus, Minus, RefreshCw, AlertTriangle, CheckCircle, FileText, Calendar, HardDrive, Database } from 'lucide-react'
import syncService from '../../services/SyncService'

const SyncModal = ({ isOpen, onClose, discrepancies, stats, onSyncComplete }) => {
  const [selectedActions, setSelectedActions] = useState({
    addFiles: [],
    removeFiles: [],
    updateFiles: []
  })
  const [isApplying, setIsApplying] = useState(false)
  const [results, setResults] = useState(null)

  if (!isOpen) return null

  const handleActionToggle = (actionType, item) => {
    setSelectedActions(prev => {
      const currentItems = prev[actionType]
      const isSelected = currentItems.some(selected => {
        if (actionType === 'addFiles') return selected.id === item.id
        if (actionType === 'removeFiles') return selected.file_id === item.file_id
        if (actionType === 'updateFiles') return selected.driveFile.id === item.driveFile.id
        return false
      })

      if (isSelected) {
        return {
          ...prev,
          [actionType]: currentItems.filter(selected => {
            if (actionType === 'addFiles') return selected.id !== item.id
            if (actionType === 'removeFiles') return selected.file_id !== item.file_id
            if (actionType === 'updateFiles') return selected.driveFile.id !== item.driveFile.id
            return true
          })
        }
      } else {
        return {
          ...prev,
          [actionType]: [...currentItems, item]
        }
      }
    })
  }

  const handleSelectAll = (actionType, items) => {
    setSelectedActions(prev => ({
      ...prev,
      [actionType]: items
    }))
  }

  const handleDeselectAll = (actionType) => {
    setSelectedActions(prev => ({
      ...prev,
      [actionType]: []
    }))
  }

  const handleApplySync = async () => {
    setIsApplying(true)
    
    try {
      const results = await syncService.applySyncActions(selectedActions)
      setResults(results)
      
      if (onSyncComplete) {
        onSyncComplete({
          success: true,
          results,
          message: 'Sincronización completada exitosamente'
        })
      }
    } catch (error) {
      console.error('Error aplicando sincronización:', error)
      setResults({
        errors: [{ error: error.message }]
      })
      
      if (onSyncComplete) {
        onSyncComplete({
          success: false,
          error: error.message,
          message: 'Error durante la sincronización'
        })
      }
    } finally {
      setIsApplying(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTotalSelectedActions = () => {
    return selectedActions.addFiles.length + 
           selectedActions.removeFiles.length + 
           selectedActions.updateFiles.length
  }

  // Si hay resultados, mostrar pantalla de resultados
  if (results) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Resultados de Sincronización</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Resumen de resultados */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{results.added?.length || 0}</div>
                <div className="text-sm text-green-700">Archivos agregados</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{results.updated?.length || 0}</div>
                <div className="text-sm text-blue-700">Archivos actualizados</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{results.removed?.length || 0}</div>
                <div className="text-sm text-red-700">Archivos removidos</div>
              </div>
            </div>

            {/* Errores si los hay */}
            {results.errors && results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-red-800 mb-2">Errores durante la sincronización:</h3>
                <ul className="space-y-1">
                  {results.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-700">
                      • {error.file?.name || 'Error general'}: {error.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mensaje de éxito */}
            {(!results.errors || results.errors.length === 0) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">¡Sincronización completada exitosamente!</span>
                </div>
                <p className="text-green-700 mt-1">
                  Todos los cambios se han aplicado correctamente a tu base de datos.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end p-6 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sincronización de Google Drive</h2>
            <p className="text-sm text-gray-600 mt-1">
              Se encontraron {stats.totalDiscrepancies} discrepancia{stats.totalDiscrepancies !== 1 ? 's' : ''} entre tu Drive y la plataforma
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Archivos nuevos en Drive */}
          {discrepancies.filesInDriveOnly.length > 0 && (
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Plus className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-gray-900">
                    Archivos nuevos en Drive ({discrepancies.filesInDriveOnly.length})
                  </h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSelectAll('addFiles', discrepancies.filesInDriveOnly)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={() => handleDeselectAll('addFiles')}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Deseleccionar todos
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {discrepancies.filesInDriveOnly.map((file) => (
                  <div key={file.id} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedActions.addFiles.some(f => f.id === file.id)}
                      onChange={() => handleActionToggle('addFiles', file)}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{file.name}</div>
                      <div className="text-sm text-gray-600 flex items-center space-x-4">
                        <span>{formatFileSize(file.size)}</span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(file.createdTime)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-green-600">
                      <HardDrive className="w-4 h-4" />
                      <span className="text-sm">En Drive</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archivos eliminados de Drive */}
          {discrepancies.filesInDbOnly.length > 0 && (
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Minus className="w-5 h-5 text-red-600" />
                  <h3 className="font-medium text-gray-900">
                    Archivos eliminados de Drive ({discrepancies.filesInDbOnly.length})
                  </h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSelectAll('removeFiles', discrepancies.filesInDbOnly)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={() => handleDeselectAll('removeFiles')}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Deseleccionar todos
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {discrepancies.filesInDbOnly.map((file) => (
                  <div key={file.file_id} className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedActions.removeFiles.some(f => f.file_id === file.file_id)}
                      onChange={() => handleActionToggle('removeFiles', file)}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{file.file_name}</div>
                      <div className="text-sm text-gray-600 flex items-center space-x-4">
                        <span>{file.file_type}</span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(file.created_at)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-red-600">
                      <Database className="w-4 h-4" />
                      <span className="text-sm">Solo en BD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archivos modificados */}
          {discrepancies.modifiedFiles.length > 0 && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-medium text-gray-900">
                    Archivos modificados ({discrepancies.modifiedFiles.length})
                  </h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSelectAll('updateFiles', discrepancies.modifiedFiles)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={() => handleDeselectAll('updateFiles')}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Deseleccionar todos
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {discrepancies.modifiedFiles.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedActions.updateFiles.some(f => f.driveFile.id === item.driveFile.id)}
                      onChange={() => handleActionToggle('updateFiles', item)}
                      className="w-4 h-4 text-yellow-600 rounded"
                    />
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.driveFile.name}</div>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <HardDrive className="w-3 h-3" />
                            <span>Drive: {formatDate(item.driveModified)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Database className="w-3 h-3" />
                            <span>BD: {formatDate(item.dbModified)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Modificado</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {getTotalSelectedActions()} acción{getTotalSelectedActions() !== 1 ? 'es' : ''} seleccionada{getTotalSelectedActions() !== 1 ? 's' : ''}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleApplySync}
              disabled={getTotalSelectedActions() === 0 || isApplying}
              className={`
                px-6 py-2 rounded-lg font-medium transition-colors
                ${getTotalSelectedActions() === 0 || isApplying
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              {isApplying ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Aplicando...</span>
                </div>
              ) : (
                'Aplicar Sincronización'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SyncModal