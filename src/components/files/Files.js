import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import fileContentExtractor from '../../services/fileContentExtractor'
import embeddingService from '../../services/embeddingService'
import {
  DocumentIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  CloudArrowUpIcon,
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const Files = () => {
  const { user, userProfile, hasActivePlan } = useAuth()
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  // Usar la instancia por defecto de googleDriveService
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (hasActivePlan()) {
      loadFolders()
      loadFiles()
    }
  }, [hasActivePlan])

  useEffect(() => {
    if (selectedFolder) {
      loadFiles(selectedFolder)
    }
  }, [selectedFolder])

  const loadFolders = async () => {
    try {
      // Cargar carpetas del usuario
      const { data: adminFolders, error: adminError } = await db.adminFolders.getByUser(user.id)
      if (adminError) throw adminError
      
      const { data: userFolders, error: userError } = await db.userFolders.getByUser(user.id)
      if (userError) throw userError
      
      console.log('Admin folders:', adminFolders)
      console.log('User folders:', userFolders)
      console.log('Current user:', user)
      
      const allFolders = [
        ...(adminFolders || []).map(f => ({ 
          ...f, 
          type: 'admin',
          google_folder_id: f.id_drive_carpeta
        })),
        ...(userFolders || []).map(f => ({ 
          ...f, 
          type: 'user',
          google_folder_id: f.id_carpeta_drive
        }))
      ]
      
      console.log('All folders combined:', allFolders)
      setFolders(allFolders)
    } catch (error) {
      console.error('Error loading folders:', error)
      toast.error('Error cargando las carpetas')
    }
  }

  const loadFiles = async (folderId = null) => {
    try {
      setLoading(true)
      
      let dbFiles = []
      
      if (folderId) {
        // Cargar archivos de una carpeta específica
        const { data, error } = await db.trainerDocuments.getByFolder(folderId)
        if (error) throw error
        dbFiles = data || []
      } else {
        // Cargar todos los archivos del usuario
        const { data, error } = await db.trainerDocuments.getByUser(user.id)
        if (error) throw error
        dbFiles = data || []
      }
      
      // Si el usuario tiene Google Drive conectado, obtener información adicional
      if (userProfile?.google_refresh_token) {
        try {
          await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          
          // Enriquecer archivos con información de Google Drive
          const enrichedFiles = await Promise.all(
            dbFiles.map(async (file) => {
              if (file.metadata?.google_file_id) {
                try {
                  const driveInfo = await googleDriveService.getFileInfo(file.metadata.google_file_id)
                  return {
                    ...file,
                    driveInfo,
                    synced: true,
                    size: driveInfo.size,
                    downloadUrl: driveInfo.webContentLink
                  }
                } catch (error) {
                  console.error(`Error getting info for file ${file.metadata?.google_file_id}:`, error)
                  return { ...file, synced: false }
                }
              }
              return { ...file, synced: false }
            })
          )
          
          setFiles(enrichedFiles)
        } catch (error) {
          console.error('Error syncing with Google Drive:', error)
          setFiles(dbFiles.map(file => ({ ...file, synced: false })))
        }
      } else {
        setFiles(dbFiles.map(file => ({ ...file, synced: false })))
      }
      
    } catch (error) {
      console.error('Error loading files:', error)
      toast.error('Error cargando los archivos')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files)
    setSelectedFiles(files)
    setShowUploadModal(true)
  }

  const handleUpload = async () => {
    if (!selectedFolder) {
      toast.error('Selecciona una carpeta para subir los archivos')
      return
    }
    
    if (selectedFiles.length === 0) {
      toast.error('Selecciona al menos un archivo')
      return
    }

    setUploading(true)
    const newUploadProgress = {}
    
    try {
      // Verificar si tiene Google Drive conectado
      if (userProfile?.google_refresh_token) {
        await googleDriveService.setTokens({
          refresh_token: userProfile.google_refresh_token
        })
      }
      
      // Obtener información de la carpeta seleccionada
      console.log('🔍 Buscando carpeta:', {
        selectedFolder,
        selectedFolderType: typeof selectedFolder,
        availableFolders: folders.map(f => ({ id: f.id, type: typeof f.id, name: f.folder_name || f.correo }))
      })
      
      const folder = folders.find(f => f.id == selectedFolder) // Usar == para comparación no estricta
      console.log('📁 Carpeta encontrada:', folder)
      
      if (!folder) {
        toast.error('Carpeta no encontrada')
        return
      }
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const fileId = `file-${i}`
        
        try {
          newUploadProgress[fileId] = 0
          setUploadProgress({ ...newUploadProgress })
          
          let googleFileId = null
          let fileSize = file.size
          
          // Subir a Google Drive si está conectado
          if (userProfile?.google_refresh_token && folder.google_folder_id) {
            const driveFile = await googleDriveService.uploadFile(
              file,
              folder.google_folder_id,
              (progress) => {
                newUploadProgress[fileId] = progress
                setUploadProgress({ ...newUploadProgress })
              }
            )
            googleFileId = driveFile.id
          }
          
          // Extraer contenido y generar embeddings reales
          let content = ''
          let embedding = []
          
          try {
            if (fileContentExtractor.isSupported(file)) {
              const processed = await embeddingService.processFile(file, fileContentExtractor)
              content = processed.content
              embedding = processed.embedding
              console.log(`✅ Contenido extraído: ${content.length} caracteres`)
            } else {
              console.warn(`⚠️ Tipo de archivo no soportado: ${file.type}`)
              content = `Archivo ${file.name} - Tipo no soportado para extracción de contenido`
              embedding = embeddingService.generateMockEmbedding()
            }
          } catch (extractError) {
            console.error('Error extrayendo contenido:', extractError)
            content = `Error extrayendo contenido de ${file.name}: ${extractError.message}`
            embedding = embeddingService.generateMockEmbedding()
          }
          
          // Guardar en la base de datos con estructura JSONB correcta
          const fileData = {
            entrenador: user.email, // Email del entrenador
            folder_id: selectedFolder,
            content: content, // Contenido extraído del archivo
            metadata: {
              name: file.name,
              correo: folder.correo || folder.folder_name, // Email de la carpeta (usuario)
              source: 'web_upload',
              file_id: googleFileId,
              file_type: file.type,
              file_size: fileSize,
              upload_date: new Date().toISOString(),
              blobType: file.type
            },
            embedding: embedding
          }
          
          const { error } = await db.trainerDocuments.create(fileData)
          if (error) throw error
          
          // Registrar también en documentos_usuario_entrenador
          const userTrainerDocData = {
            file_id: googleFileId, // ID del archivo en Google Drive
            file_type: file.type,
            file_name: file.name,
            usuario: folder.correo || folder.folder_name, // Email de la carpeta (usuario)
            entrenador: user.email, // Email del entrenador que sube el archivo
            created_at: new Date().toISOString()
          }
          
          const { error: userTrainerError } = await db.userTrainerDocuments.create(userTrainerDocData)
          if (userTrainerError) {
            console.error('Error registrando en documentos_usuario_entrenador:', userTrainerError)
            // No lanzamos error para no interrumpir el flujo principal
          }
          
          // Actualizar estadísticas del usuario
          const embeddingSize = embedding.length * 4 // 4 bytes por float
          const tokensUsed = Math.ceil(file.size / 1000) // Simulación de tokens
          
          // Actualizar almacenamiento usado
          await db.users.update(user.id, {
            used_storage_bytes: (userProfile.used_storage_bytes || 0) + embeddingSize
          })
          
          // Actualizar tokens usados en tabla separada
          const { data: tokenUsage } = await supabase
            .from('user_tokens_usage')
            .select('total_tokens')
            .eq('user_id', user.id)
            .single()
          
          if (tokenUsage) {
            await supabase
              .from('user_tokens_usage')
              .update({
                total_tokens: (tokenUsage.total_tokens || 0) + tokensUsed,
                last_updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
          } else {
            await supabase
              .from('user_tokens_usage')
              .insert({
                user_id: user.id,
                total_tokens: tokensUsed,
                last_updated_at: new Date().toISOString()
              })
          }
          
          newUploadProgress[fileId] = 100
          setUploadProgress({ ...newUploadProgress })
          
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error)
          toast.error(`Error subiendo ${file.name}`)
        }
      }
      
      toast.success(`${selectedFiles.length} archivo(s) subido(s) exitosamente`)
      
      // Recargar archivos
      await loadFiles(selectedFolder)
      
      // Limpiar estado
      setSelectedFiles([])
      setShowUploadModal(false)
      setUploadProgress({})
      
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Error subiendo los archivos')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${file.metadata?.name || file.metadata?.file_name || 'este archivo'}"?`)) {
      return
    }
    
    try {
      // Eliminar de Google Drive si existe
      if ((file.metadata?.google_file_id || file.metadata?.file_id) && userProfile?.google_refresh_token) {
        try {
          await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          const fileIdToDelete = file.metadata?.google_file_id || file.metadata?.file_id
          await googleDriveService.deleteFile(fileIdToDelete)
          console.log('Archivo eliminado de Google Drive:', fileIdToDelete)
        } catch (error) {
          console.error('Error deleting from Google Drive:', error)
        }
      }
      
      // Eliminar de la base de datos
      const { error } = await db.trainerDocuments.delete(file.id)
      if (error) throw error
      
      // También eliminar de documentos_usuario_entrenador si existe el file_id
      if (file.metadata?.file_id) {
        const { error: userTrainerDeleteError } = await db.userTrainerDocuments.deleteByFileId(file.metadata.file_id)
        if (userTrainerDeleteError) {
          console.error('Error eliminando de documentos_usuario_entrenador:', userTrainerDeleteError)
          // No lanzamos error para no interrumpir el flujo principal
        }
      }
      
      // Actualizar estadísticas del usuario
      const embeddingSize = file.embedding ? file.embedding.length * 4 : 0
      const currentStorage = Math.max(0, (userProfile.used_storage_bytes || 0) - embeddingSize)
      
      await db.users.update(user.id, {
        used_storage_bytes: currentStorage
      })
      
      // Recargar archivos
      await loadFiles(selectedFolder)
      toast.success('Archivo eliminado exitosamente')
      
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Error eliminando el archivo')
    }
  }

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return PhotoIcon
    if (fileType?.startsWith('video/')) return FilmIcon
    if (fileType?.startsWith('audio/')) return MusicalNoteIcon
    if (fileType?.includes('pdf') || fileType?.includes('document')) return DocumentTextIcon
    if (fileType?.includes('zip') || fileType?.includes('rar')) return ArchiveBoxIcon
    return DocumentIcon
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredAndSortedFiles = files
    .filter(file => {
      const fileName = file.metadata?.name || file.metadata?.file_name || ''
      const fileType = file.metadata?.file_type || ''
      const matchesSearch = fileName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = fileTypeFilter === 'all' || 
        (fileTypeFilter === 'pdf' && (fileType?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf'))) ||
        (fileTypeFilter === 'excel' && (fileType?.includes('spreadsheet') || fileType?.includes('excel') || fileName.toLowerCase().match(/\.(xlsx?|xls)$/))) ||
        (fileTypeFilter === 'word' && (fileType?.includes('document') || fileType?.includes('word') || fileName.toLowerCase().match(/\.(docx?|doc)$/)))
      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'name':
          aValue = (a.metadata?.name || a.metadata?.file_name || '').toLowerCase()
        bValue = (b.metadata?.name || b.metadata?.file_name || '').toLowerCase()
          break
        case 'size':
          aValue = a.metadata?.file_size || 0
          bValue = b.metadata?.file_size || 0
          break
        case 'type':
          aValue = a.metadata?.file_type || ''
          bValue = b.metadata?.file_type || ''
          break
        default: // date
          aValue = new Date(a.created_at || 0)
        bValue = new Date(b.created_at || 0)
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  if (!hasActivePlan()) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Plan Requerido
        </h3>
        <p className="text-gray-600 mb-6">
          Necesitas un plan activo para acceder a la gestión de archivos.
        </p>
        <button
          onClick={() => window.location.href = '/plans'}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Ver Planes
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Archivos</h1>
          <p className="text-gray-600 mt-1">
            Sube y organiza tus documentos
          </p>
        </div>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 sm:mt-0 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center"
        >
          <CloudArrowUpIcon className="h-5 w-5 mr-2" />
          Subir Archivos
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Carpeta
          </label>
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Todas las carpetas</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.type === 'admin' ? folder.folder_name : folder.correo || 'Carpeta sin nombre'} ({folder.type === 'admin' ? 'Principal' : 'Usuario'})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de archivo
          </label>
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Todos</option>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="word">Word</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ordenar por
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="date">Fecha</option>
            <option value="name">Nombre</option>
            <option value="size">Tamaño</option>
            <option value="type">Tipo</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Orden
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar archivos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Files List */}
      {loading ? (
        <LoadingSpinner text="Cargando archivos..." />
      ) : filteredAndSortedFiles.length === 0 ? (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || fileTypeFilter !== 'all' ? 'No se encontraron archivos' : 'No hay archivos'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || fileTypeFilter !== 'all'
              ? 'Intenta con otros filtros de búsqueda'
              : 'Sube tu primer archivo para comenzar'
            }
          </p>
          {!searchTerm && fileTypeFilter === 'all' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Subir Primer Archivo
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tamaño
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedFiles.map((file) => {
                  const FileIcon = getFileIcon(file.metadata?.file_type)
                  
                  return (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileIcon className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {file.metadata?.name || file.metadata?.file_name || 'Sin nombre'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {file.metadata?.file_type || 'Tipo desconocido'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatFileSize(file.metadata?.file_size || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(file.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            file.synced ? 'bg-green-400' : 'bg-yellow-400'
                          }`} />
                          <span className="text-sm text-gray-600">
                            {file.synced ? 'Sincronizado' : 'Solo local'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {file.metadata?.file_id && (
                            <a
                              href={`https://drive.google.com/file/d/${file.metadata.file_id}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Ver documento"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </a>
                          )}
                          {file.downloadUrl && (
                            <a
                              href={file.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 p-1"
                              title="Descargar"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteFile(file)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Eliminar"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Subir Archivos
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carpeta de destino
                </label>
                <select
                  value={selectedFolder}
                  onChange={(e) => {
                    console.log('📂 Carpeta seleccionada:', e.target.value, typeof e.target.value)
                    setSelectedFolder(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Seleccionar carpeta</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.type === 'admin' ? folder.folder_name : folder.correo || 'Carpeta sin nombre'}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivos seleccionados ({selectedFiles.length})
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="text-sm text-gray-600 flex items-center justify-between">
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {uploading && (
                <div className="space-y-2">
                  {Object.entries(uploadProgress).map(([fileId, progress]) => (
                    <div key={fileId}>
                      <div className="flex justify-between text-sm">
                        <span>Subiendo...</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setSelectedFiles([])
                  setUploadProgress({})
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFolder || selectedFiles.length === 0}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Subiendo...' : 'Subir Archivos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Files