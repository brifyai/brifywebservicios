import React, { useState, useCallback, useEffect } from 'react'
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const DragDropUpload = ({ 
  onFilesSelected, 
  onUpload, 
  selectedFolder = null,
  folders = [],
  onFolderChange = null,
  acceptedTypes = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain',
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB por defecto
  className = '',
  showFolderSelector = true,
  uploading = false,
  uploadProgress = {},
  clearFilesAfterUpload = true,
  children
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [dragCounter, setDragCounter] = useState(0)
  const [wasUploading, setWasUploading] = useState(false)

  // Detectar cuando la subida se complete exitosamente y limpiar archivos
  useEffect(() => {
    if (clearFilesAfterUpload && wasUploading && !uploading && selectedFiles.length > 0) {
      // Si la subida terminó (uploading cambió de true a false), limpiar archivos
      // No dependemos del uploadProgress porque se resetea inmediatamente
      setSelectedFiles([])
      onFilesSelected?.([])
    }
    
    // Actualizar el estado de "estaba subiendo"
    setWasUploading(uploading)
  }, [uploading, selectedFiles.length, clearFilesAfterUpload, onFilesSelected, wasUploading])

  // Validar tipo de archivo
  const isValidFileType = useCallback((file) => {
    if (!acceptedTypes) return true
    
    const acceptedTypesArray = acceptedTypes.split(',')
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
    const fileMimeType = file.type
    
    return acceptedTypesArray.some(type => {
      const cleanType = type.trim()
      return cleanType === fileExtension || cleanType === fileMimeType
    })
  }, [acceptedTypes])

  // Validar tamaño de archivo
  const isValidFileSize = useCallback((file) => {
    return file.size <= maxFileSize
  }, [maxFileSize])

  // Formatear tamaño de archivo
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Procesar archivos seleccionados
  const processFiles = useCallback((fileList) => {
    const files = Array.from(fileList)
    const validFiles = []
    const errors = []

    // Verificar límite de archivos
    if (selectedFiles.length + files.length > maxFiles) {
      toast.error(`Máximo ${maxFiles} archivos permitidos`)
      return
    }

    files.forEach(file => {
      // Verificar si el archivo ya está seleccionado
      if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
        errors.push(`${file.name}: Archivo ya seleccionado`)
        return
      }

      // Validar tipo de archivo
      if (!isValidFileType(file)) {
        errors.push(`${file.name}: Tipo de archivo no permitido`)
        return
      }

      // Validar tamaño de archivo
      if (!isValidFileSize(file)) {
        errors.push(`${file.name}: Archivo demasiado grande (máx. ${formatFileSize(maxFileSize)})`)
        return
      }

      validFiles.push(file)
    })

    // Mostrar errores si los hay
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error))
    }

    // Agregar archivos válidos
    if (validFiles.length > 0) {
      const newSelectedFiles = [...selectedFiles, ...validFiles]
      setSelectedFiles(newSelectedFiles)
      onFilesSelected?.(newSelectedFiles)
      toast.success(`${validFiles.length} archivo(s) seleccionado(s)`)
    }
  }, [selectedFiles, maxFiles, isValidFileType, isValidFileSize, maxFileSize, onFilesSelected])

  // Manejar drag enter
  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => prev + 1)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }, [])

  // Manejar drag leave
  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      const newCounter = prev - 1
      if (newCounter === 0) {
        setIsDragOver(false)
      }
      return newCounter
    })
  }, [])

  // Manejar drag over
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Manejar drop
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragCounter(0)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processFiles(files)
    }
  }, [processFiles])

  // Manejar selección de archivos desde input
  const handleFileSelect = useCallback((e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFiles(files)
    }
    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    e.target.value = ''
  }, [processFiles])

  // Remover archivo seleccionado
  const removeFile = useCallback((index) => {
    const newSelectedFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newSelectedFiles)
    onFilesSelected?.(newSelectedFiles)
  }, [selectedFiles, onFilesSelected])

  // Limpiar archivos seleccionados
  const clearFiles = useCallback(() => {
    setSelectedFiles([])
    onFilesSelected?.([])
  }, [onFilesSelected])

  // Manejar subida
  const handleUpload = useCallback(() => {
    if (selectedFiles.length === 0) {
      toast.error('Selecciona al menos un archivo')
      return
    }

    if (showFolderSelector && !selectedFolder) {
      toast.error('Selecciona una carpeta de destino')
      return
    }

    onUpload?.(selectedFiles, selectedFolder)
  }, [selectedFiles, selectedFolder, showFolderSelector, onUpload])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zona de drag & drop */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragOver 
            ? 'border-primary-500 bg-primary-50 scale-105' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        
        <div className="space-y-4">
          <CloudArrowUpIcon className={`mx-auto h-12 w-12 ${
            isDragOver ? 'text-primary-500' : 'text-gray-400'
          }`} />
          
          <div>
            <h3 className={`text-lg font-medium ${
              isDragOver ? 'text-primary-700' : 'text-gray-900'
            }`}>
              {isDragOver ? '¡Suelta los archivos aquí!' : 'Arrastra archivos aquí'}
            </h3>
            <p className="text-gray-600 mt-1">
              o <span className="text-primary-600 font-medium">haz clic para seleccionar</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Máximo {maxFiles} archivos • Tamaño máximo: {formatFileSize(maxFileSize)}
            </p>
          </div>
        </div>
        
        {/* Overlay cuando se está arrastrando */}
        {isDragOver && (
          <div className="absolute inset-0 bg-primary-500 bg-opacity-10 rounded-lg flex items-center justify-center">
            <div className="text-primary-700 font-medium text-lg">
              ¡Suelta aquí!
            </div>
          </div>
        )}
      </div>

      {/* Selector de carpeta */}
      {showFolderSelector && folders.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Carpeta de destino
          </label>
          <select
            value={selectedFolder || ''}
            onChange={(e) => onFolderChange?.(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={uploading}
          >
            <option value="">Seleccionar carpeta</option>
            {folders
              .filter(folder => {
                const name = folder.type === 'admin' ? folder.folder_name : folder.correo
                return name && name.trim() !== ''
              })
              .map((folder) => {
                const displayName = folder.type === 'admin' 
                  ? folder.folder_name 
                  : `${folder.correo} (Usuario)`
                return (
                  <option key={folder.id} value={folder.id}>
                    {displayName}
                  </option>
                )
              })}
          </select>
        </div>
      )}

      {/* Lista de archivos seleccionados */}
      {selectedFiles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">
              Archivos seleccionados ({selectedFiles.length})
            </h4>
            <button
              onClick={clearFiles}
              className="text-sm text-red-600 hover:text-red-700"
              disabled={uploading}
            >
              Limpiar todo
            </button>
          </div>
          
          <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
            {selectedFiles.map((file, index) => {
              const fileId = `file-${index}`
              const progress = uploadProgress[fileId] || 0
              const hasError = progress === -1
              
              return (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-3 flex-1">
                    <DocumentIcon className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                      
                      {/* Barra de progreso durante la subida */}
                      {uploading && progress > 0 && (
                        <div className="mt-1">
                          <div className="flex justify-between text-xs">
                            <span className={hasError ? 'text-red-600' : 'text-gray-600'}>
                              {hasError ? 'Error' : `${progress}%`}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                hasError ? 'bg-red-500' : 'bg-primary-500'
                              }`}
                              style={{ width: hasError ? '100%' : `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!uploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Botón de subida */}
      {selectedFiles.length > 0 && (
        <div className="flex justify-end space-x-3">
          {!uploading && (
            <button
              onClick={clearFiles}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          )}
          
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0 || (showFolderSelector && !selectedFolder)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <CloudArrowUpIcon className="h-5 w-5 mr-2" />
            {uploading ? 'Subiendo...' : `Subir ${selectedFiles.length} archivo(s)`}
          </button>
        </div>
      )}

      {/* Contenido adicional */}
      {children}
    </div>
  )
}

export default DragDropUpload