import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import emailService from '../../lib/emailService'
import {
  FolderIcon,
  DocumentIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  UserIcon,
  CalendarIcon,
  CloudArrowUpIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import DragDropUpload from '../common/DragDropUpload'
import RoutineUpload from '../routines/RoutineUpload'
import fileContentExtractor from '../../services/fileContentExtractor'
import embeddingService from '../../services/embeddingService'
import { useUserExtensions } from '../../hooks/useUserExtensions'
import toast from 'react-hot-toast'

const Folders = () => {
  const { user, userProfile, hasActivePlan } = useAuth()
  const { hasExtension } = useUserExtensions()
  const navigate = useNavigate()
  const [folders, setFolders] = useState([])
  const [currentFolder, setCurrentFolder] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([{ name: 'Inicio', id: null }])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderEmail, setNewFolderEmail] = useState('')
  const [folderType, setFolderType] = useState('Alumno') // Para extensión Entrenador
  const [selectedParentFolder, setSelectedParentFolder] = useState(null)
  const [availableSubFolders, setAvailableSubFolders] = useState([])

  const [searchTerm, setSearchTerm] = useState('')
  const [ranEnsureOnce, setRanEnsureOnce] = useState(false)

  // Estados para gestión de archivos
  const [activeTab, setActiveTab] = useState('folders') // 'folders' o 'files'
  const [files, setFiles] = useState([])
  const [selectedFileFolder, setSelectedFileFolder] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [showRoutineUpload, setShowRoutineUpload] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [fileSearchTerm, setFileSearchTerm] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showDragDropUpload, setShowDragDropUpload] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const fileInputRef = React.useRef(null)

  useEffect(() => {
    if (hasActivePlan) {
      loadAdminFolderByDefault()
      loadAvailableSubFolders()
      loadFiles()
    }
  }, [hasActivePlan])

  useEffect(() => {
    if (selectedFileFolder) {
      loadFiles(selectedFileFolder)
    } else {
      loadFiles()
    }
  }, [selectedFileFolder])

  // Funciones para gestión de archivos
  const loadFiles = async (folderId = null) => {
    try {
      setLoading(true)
      
      let dbFiles = []
      
      // Construir query para archivos de administrador con filtro opcional por carpeta
      let adminQuery = supabase
        .from('documentos_administrador')
        .select('*')
        .eq('administrador', user.email)
      
      // Si hay un folderId seleccionado, filtrar por carpeta_actual
      if (folderId) {
        adminQuery = adminQuery.eq('carpeta_actual', folderId)
      }
      
      const { data: adminFiles, error: adminError } = await adminQuery
        .order('created_at', { ascending: false })
      
      if (adminError) throw adminError
      
      // Transformar archivos de administrador
      const adminFilesTransformed = (adminFiles || []).map(file => ({
        id: file.id,
        created_at: file.created_at,
        metadata: {
          name: file.name || file.file_name || 'Sin nombre',
          file_name: file.name || file.file_name || 'Sin nombre',
          file_type: file.file_type,
          file_id: file.file_id,
          source: 'documentos_administrador',
          correo: file.administrador,
          service_type: 'Admin'
        },
        entrenador: file.administrador,
        usuario: file.administrador,
        google_file_id: file.file_id,
        type: 'admin',
        service_type: 'Admin'
      }))
      
      // Cargar archivos desde documentos_usuario_entrenador
      let userQuery = supabase
        .from('documentos_usuario_entrenador')
        .select('*')
      
      if (folderId) {
        const selectedFolderData = folders.find(folder => folder.id === folderId)
        if (selectedFolderData) {
          const folderEmail = selectedFolderData.correo || selectedFolderData.folder_name
          if (folderEmail) {
            userQuery = userQuery.eq('usuario', folderEmail)
          }
        }
      }
      
      const { data: userFiles, error: userError } = await userQuery
        .order('created_at', { ascending: false })
      
      if (userError) throw userError
      
      // Transformar archivos de usuario
      const userFilesTransformed = (userFiles || []).map(file => ({
        id: file.id,
        created_at: file.created_at,
        metadata: {
          name: file.file_name || 'Sin nombre',
          file_name: file.file_name || 'Sin nombre',
          file_type: file.file_type,
          file_id: file.file_id,
          source: 'documentos_usuario_entrenador',
          correo: file.usuario,
          service_type: 'Usuario'
        },
        entrenador: file.entrenador,
        usuario: file.usuario,
        google_file_id: file.file_id,
        type: 'user',
        service_type: 'Usuario'
      }))
      
      // Combinar todos los archivos
      dbFiles = [...adminFilesTransformed, ...userFilesTransformed]
      
      // Si el usuario tiene Google Drive conectado, obtener información adicional
      if (userProfile?.google_refresh_token) {
        try {
          await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          
          const enrichedFiles = await Promise.all(
            dbFiles.map(async (file) => {
              if (file.google_file_id) {
                try {
                  const driveInfo = await googleDriveService.getFileInfo(file.google_file_id)
                  return {
                    ...file,
                    driveInfo,
                    synced: true,
                    size: driveInfo.size,
                    downloadUrl: driveInfo.webContentLink
                  }
                } catch (error) {
                  console.error(`Error getting info for file ${file.google_file_id}:`, error)
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

  const validateFileType = (file) => {
    const allowedFileTypes = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt'
    }
    
    const blockedExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.dll',
      '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
      '.js', '.vbs', '.ps1', '.sh'
    ]
    
    const fileName = file.name.toLowerCase()
    const fileType = file.type
    
    const hasBlockedExtension = blockedExtensions.some(ext => fileName.endsWith(ext))
    if (hasBlockedExtension) {
      return {
        valid: false,
        reason: `Archivo ${file.name}: Tipo de archivo no permitido por seguridad`
      }
    }
    
    if (fileType && allowedFileTypes[fileType]) {
      return { valid: true }
    }
    
    const allowedExtensions = Object.values(allowedFileTypes)
    const hasAllowedExtension = allowedExtensions.some(ext => fileName.endsWith(ext))
    
    if (hasAllowedExtension) {
      return { valid: true }
    }
    
    return {
      valid: false,
      reason: `Archivo ${file.name}: Solo se permiten documentos PDF, Word, Excel, PowerPoint y archivos de texto`
    }
  }

  const handleFileSelect = (event) => {
    const files = Array.isArray(event) ? event : Array.from(event.target.files)
    
    const validationResults = files.map(validateFileType)
    const invalidFiles = validationResults.filter(result => !result.valid)
    
    if (invalidFiles.length > 0) {
      invalidFiles.forEach(result => {
        toast.error(result.reason)
      })
      
      const validFiles = files.filter((file, index) => validationResults[index].valid)
      
      if (validFiles.length === 0) {
        event.target.value = ''
        return
      }
      
      setSelectedFiles(validFiles)
      toast.success(`${validFiles.length} archivo(s) válido(s) seleccionado(s)`)
    } else {
      setSelectedFiles(files)
      toast.success(`${files.length} archivo(s) seleccionado(s)`)
    }
  }

  const handleUpload = async () => {
    if (!selectedFileFolder) {
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
      if (userProfile?.google_refresh_token) {
        await googleDriveService.setTokens({
          refresh_token: userProfile.google_refresh_token
        })
      }
      
      const folder = folders.find(f => f.id == selectedFileFolder)
      
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
          } else {
            googleFileId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }
          
          let content = ''
          let embedding = []
          let tokensUsed = 0
          
          try {
            if (fileContentExtractor.isSupported(file)) {
              const processed = await embeddingService.processFile(file, fileContentExtractor)
              content = processed.content
              embedding = processed.embedding
              
              newUploadProgress[fileId] = 20
              setUploadProgress({ ...newUploadProgress })
              
              tokensUsed = Math.ceil(content.length / 4)
              
              const embeddingsServiceLib = await import('../../lib/embeddings')
              await embeddingsServiceLib.default.trackTokenUsage(user.id, tokensUsed, 'file_embedding')
              
            } else {
              throw new Error(`Formato de archivo no compatible: ${file.type}. Solo se permiten documentos de texto, PDF, Word y Excel.`)
            }
          } catch (extractError) {
            throw new Error(`No se pudo procesar el archivo ${file.name}: ${extractError.message}`)
          }
          
          const MAX_CONTENT_LENGTH = 10240
          let contentToStore = content
          
          if (content.length > MAX_CONTENT_LENGTH) {
            const embeddingsServiceLib = await import('../../lib/embeddings')
            const chunks = embeddingsServiceLib.default.splitTextIntoChunks(content, 8000)
            
            contentToStore = content.substring(0, MAX_CONTENT_LENGTH - 200) +
              `\n\n[DOCUMENTO DIVIDIDO EN CHUNKS: Este documento fue dividido en ${chunks.length} partes para optimizar la búsqueda. Contenido total: ${content.length} caracteres]`
            
            const baseMetadata = {
              name: file.name,
              correo: folder.correo || folder.folder_name,
              source: 'web_upload',
              file_id: googleFileId,
              file_type: file.type,
              file_size: fileSize,
              upload_date: new Date().toISOString(),
              blobType: file.type,
              is_chunked: true,
              original_length: content.length,
              chunks_count: chunks.length,
              chunk_type: 'main'
            }
            
            const mainFileData = {
              administrador: user.email,
              carpeta_actual: selectedFileFolder,
              content: contentToStore,
              name: file.name,
              file_type: file.type,
              file_id: googleFileId,
              file_size: fileSize,
              metadata: {
                ...baseMetadata,
                correo: folder.correo || folder.folder_name
              },
              embedding: embedding
            }
            
            const { error: mainError } = await db.adminDocuments.create(mainFileData)
            if (mainError) throw mainError
            
            newUploadProgress[fileId] = 30
            setUploadProgress({ ...newUploadProgress })
            
            let successfulChunks = 0
            for (let j = 0; j < chunks.length; j++) {
              try {
                const chunkEmbeddingResult = await embeddingsServiceLib.default.generateEmbedding(chunks[j], user.id)
                
                const chunkData = {
                  administrador: user.email,
                  carpeta_actual: selectedFileFolder,
                  content: chunks[j],
                  name: `${file.name} - Parte ${j + 1}`,
                  file_type: file.type,
                  file_id: googleFileId,
                  file_size: Math.round(fileSize / chunks.length),
                  metadata: {
                    ...baseMetadata,
                    chunk_type: 'chunk',
                    chunk_index: j + 1,
                    parent_file_id: googleFileId,
                    chunk_of_total: `${j + 1}/${chunks.length}`,
                    source: 'chunk_from_web_upload',
                    correo: folder.correo || folder.folder_name
                  },
                  embedding: chunkEmbeddingResult.embedding
                }
                
                const { error: chunkError } = await db.adminDocuments.create(chunkData)
                if (chunkError) {
                  console.error(`Error guardando chunk ${j + 1}:`, chunkError)
                } else {
                  successfulChunks++
                  
                  const baseProgress = 30
                  const chunkProgress = Math.round((successfulChunks / chunks.length) * 70)
                  const totalProgress = Math.min(baseProgress + chunkProgress, 99)
                  
                  newUploadProgress[fileId] = totalProgress
                  setUploadProgress({ ...newUploadProgress })
                }
                
                await embeddingsServiceLib.default.trackTokenUsage(user.id, chunkEmbeddingResult.tokens_used, 'file_embedding')
                
              } catch (chunkError) {
                console.error(`Error procesando chunk ${j + 1}:`, chunkError)
              }
            }
            
            await supabase
              .from('documentos_administrador')
              .update({
                metadata: {
                  ...baseMetadata,
                  chunks_created: successfulChunks,
                  chunks_failed: chunks.length - successfulChunks,
                  correo: folder.correo || folder.folder_name
                }
              })
              .eq('id', mainFileData.id)
            
            const userTrainerDocData = {
              file_id: googleFileId,
              file_type: file.type,
              file_name: file.name,
              usuario: folder.correo || folder.folder_name,
              entrenador: user.email
            }
            
            const { error: userTrainerError } = await db.userTrainerDocuments.create(userTrainerDocData)
            if (userTrainerError) {
              console.error('❌ Error registrando en documentos_usuario_entrenador:', userTrainerError)
            }
            
            const embeddingSize = embedding.length * 4
            await db.users.update(user.id, {
              used_storage_bytes: (userProfile.used_storage_bytes || 0) + embeddingSize
            })
            
            newUploadProgress[fileId] = 100
            setUploadProgress({ ...newUploadProgress })
            
            continue
          }
          
          const fileData = {
            administrador: user.email,
            carpeta_actual: selectedFileFolder,
            content: contentToStore,
            name: file.name,
            file_type: file.type,
            file_id: googleFileId,
            file_size: fileSize,
            metadata: {
              correo: folder.correo || folder.folder_name,
              source: 'web_upload',
              upload_date: new Date().toISOString(),
              blobType: file.type,
              is_chunked: content.length > MAX_CONTENT_LENGTH,
              original_length: content.length,
              chunks_count: content.length > MAX_CONTENT_LENGTH ? Math.ceil(content.length / 8000) : 1
            },
            embedding: embedding
          }
          
          const { error } = await db.adminDocuments.create(fileData)
          if (error) throw error
          
          const userTrainerDocData = {
            file_id: googleFileId,
            file_type: file.type,
            file_name: file.name,
            usuario: folder.correo || folder.folder_name,
            entrenador: user.email
          }
          
          const { data: userTrainerData, error: userTrainerError } = await db.userTrainerDocuments.create(userTrainerDocData)
          if (userTrainerError) {
            console.error('❌ Error registrando en documentos_usuario_entrenador:', userTrainerError)
          }
          
          const embeddingSize = embedding.length * 4
          await db.users.update(user.id, {
            used_storage_bytes: (userProfile.used_storage_bytes || 0) + embeddingSize
          })
          
          newUploadProgress[fileId] = 100
          setUploadProgress({ ...newUploadProgress })
          
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error)
          
          if (error.message.includes('No se pudo procesar el archivo') ||
              error.message.includes('Formato de archivo no compatible')) {
            toast.error(`${file.name}: ${error.message}`)
          } else {
            toast.error(`Error subiendo ${file.name}: ${error.message}`)
          }
          
          newUploadProgress[fileId] = -1
          setUploadProgress({ ...newUploadProgress })
        }
      }
      
      const successfulFiles = Object.values(newUploadProgress).filter(progress => progress === 100).length
      const failedFiles = Object.values(newUploadProgress).filter(progress => progress === -1).length
      
      if (successfulFiles > 0 && failedFiles === 0) {
        toast.success(`${successfulFiles} archivo(s) subido(s) exitosamente`)
      } else if (successfulFiles > 0 && failedFiles > 0) {
        toast.success(`${successfulFiles} archivo(s) subido(s) exitosamente. ${failedFiles} archivo(s) fallaron.`)
      } else if (failedFiles > 0) {
        toast.error(`Todos los archivos fallaron al subirse`)
      }
      
      await loadFiles(selectedFileFolder)
      
      setSelectedFiles([])
      setShowDragDropUpload(false)
      setUploadProgress({})
      
      setTimeout(() => {
        setShowDragDropUpload(true)
      }, 2000)
      
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
      if (file.google_file_id && userProfile?.google_refresh_token) {
        try {
          await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          await googleDriveService.deleteFile(file.google_file_id)
        } catch (error) {
          console.error('Error deleting from Google Drive:', error)
        }
      }
      
      const { error: userTrainerDeleteError } = await supabase
        .from('documentos_usuario_entrenador')
        .delete()
        .eq('id', file.id)
      
      if (userTrainerDeleteError) throw userTrainerDeleteError
      
      if (file.google_file_id) {
        const { error: chunksDeleteError } = await supabase
          .from('documentos_entrenador')
          .delete()
          .eq('metadata->>file_id', file.google_file_id)
        
        if (chunksDeleteError) {
          console.error('Error eliminando chunks de documentos_entrenador:', chunksDeleteError)
        }
      }
      
      setFiles([])
      await loadFiles(selectedFileFolder)
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

  const filteredAndSortedFiles = files
    .filter(file => {
      const fileName = file.metadata?.name || file.metadata?.file_name || ''
      const fileType = file.metadata?.file_type || ''
      const matchesSearch = fileName.toLowerCase().includes(fileSearchTerm.toLowerCase())
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
        default:
          aValue = new Date(a.created_at || 0)
          bValue = new Date(b.created_at || 0)
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  // Función para sincronizar con Google Drive
  const handleSyncDrive = async () => {
    if (!userProfile?.google_refresh_token) {
      toast.error('Necesitas conectar tu cuenta de Google Drive primero')
      return
    }

    setSyncing(true)
    try {
      await googleDriveService.setTokens({
        refresh_token: userProfile.google_refresh_token
      })

      if (activeTab === 'folders') {
        // Sincronizar carpetas
        await loadFolders(currentFolder?.id)
        toast.success('Carpetas sincronizadas exitosamente')
      } else {
        // Sincronizar archivos
        await loadFiles(selectedFileFolder)
        toast.success('Archivos sincronizados exitosamente')
      }
    } catch (error) {
      console.error('Error syncing with Google Drive:', error)
      toast.error('Error sincronizando con Google Drive')
    } finally {
      setSyncing(false)
    }
  }

  // Cargar subcarpetas disponibles para selección de carpeta padre
  const loadAvailableSubFolders = async () => {
    try {
      console.log('🔄 Iniciando carga de subcarpetas...')
      
      // Realizar ambas consultas en paralelo para mejorar rendimiento
      const [subFoldersResult, userExtensionsResult] = await Promise.all([
        // Consulta de subcarpetas
        supabase
          .from('sub_carpetas_administrador')
          .select('*')
          .eq('administrador_email', user.email),
        // Consulta de extensiones del usuario
        supabase
          .from('plan_extensiones')
          .select(`
            *,
            extensiones (
              id,
              name,
              name_es,
              description,
              description_es,
              price,
              disponible
            )
          `)
          .eq('user_id', user.id)
      ])
      
      let subFolders = subFoldersResult.data
      let error = subFoldersResult.error
      
      // Si no encuentra subcarpetas, intentar con el email del administrador de carpeta_administrador
      if ((!subFolders || subFolders.length === 0) && !error) {
        console.log('🔍 No se encontraron subcarpetas, buscando con administrador...')
        const { data: adminData } = await db.adminFolders.getByUser(user.id)
        if (adminData && adminData.length > 0) {
          const adminEmail = adminData[0].correo // Usar 'correo' en lugar de 'administrador'
          console.log('📧 Email del administrador encontrado:', adminEmail)
          const result = await supabase
            .from('sub_carpetas_administrador')
            .select('*')
            .eq('administrador_email', adminEmail)
          subFolders = result.data
          error = result.error
          console.log('🔍 Subcarpetas encontradas con email del administrador:', subFolders?.length || 0)
        }
      }
      
      if (error) {
        console.error('❌ Error loading subfolders:', error)
        return
      }
      
      const userExtensions = userExtensionsResult.data
      if (userExtensionsResult.error) {
        console.error('❌ Error loading user extensions:', userExtensionsResult.error)
        return
      }
      
      console.log('📊 Extensiones del usuario:', userExtensions)
      console.log('📁 Subcarpetas encontradas:', subFolders)
      
      // Crear mapeo de extensiones activas para mejor rendimiento
      const activeExtensionTypes = new Set(['brify']) // Brify siempre disponible
      
      userExtensions?.forEach(ext => {
        const extensionName = ext.extensiones?.name_es || ext.extensiones?.name
        if (extensionName === 'Entrenador') activeExtensionTypes.add('entrenador')
        if (extensionName === 'Abogados') activeExtensionTypes.add('abogados')
        if (extensionName === 'Veterinarios') activeExtensionTypes.add('veterinarios')
      })
      
      console.log('🎯 Tipos de extensión activos:', Array.from(activeExtensionTypes))
      
      // Filtrar subcarpetas según extensiones activas del usuario
      const availableSubFolders = (subFolders || []).filter(subfolder => {
        const isAvailable = activeExtensionTypes.has(subfolder.tipo_extension)
        console.log(`📋 Subcarpeta ${subfolder.nombre_subcarpeta} (${subfolder.tipo_extension}): ${isAvailable ? 'DISPONIBLE' : 'NO DISPONIBLE'}`)
        return isAvailable
      })
      
      console.log('✅ Subcarpetas disponibles finales:', availableSubFolders)
      setAvailableSubFolders(availableSubFolders)
      
      // Seleccionar Brify por defecto si está disponible
      const defaultFolder = availableSubFolders.find(f => f.tipo_extension === 'brify') || availableSubFolders[0]
      console.log('🎯 Carpeta por defecto seleccionada:', defaultFolder)
      setSelectedParentFolder(defaultFolder)
    } catch (error) {
      console.error('❌ Error loading available subfolders:', error)
    }
  }

  // Refuerzo idempotente: asegura subcarpetas para extensiones activas si faltan
  const ensureAdminSubFoldersForUser = async () => {
    try {
      if (!user) return

      // Obtener carpeta Master del administrador
      const { data: adminData, error: adminError } = await db.adminFolders.getByUser(user.id)
      if (adminError) {
        console.error('❌ Error obteniendo carpeta administrador:', adminError)
        return
      }
      if (!adminData || adminData.length === 0) {
        console.warn('⚠️ No existe carpeta administrador; se omite reconciliación de subcarpetas')
        return
      }
      const masterFolderId = adminData[0].id_drive_carpeta

      // Configurar tokens de Google Drive
      const { data: credentials } = await db.userCredentials.getByUserId(user.id)
      if (!credentials || (!credentials.google_access_token && !credentials.google_refresh_token)) {
        console.warn('⚠️ Credenciales de Google Drive no disponibles; no se pueden crear subcarpetas')
        return
      }
      const tokensOk = await googleDriveService.setTokens({
        access_token: credentials.google_access_token,
        refresh_token: credentials.google_refresh_token
      })
      if (!tokensOk) {
        console.warn('⚠️ No se pudieron configurar tokens de Google Drive')
        return
      }

      // Subcarpetas ya registradas
      const { data: existingSubFolders, error: subError } = await db.subCarpetasAdministrador.getByMasterFolderId(masterFolderId)
      if (subError) {
        console.error('❌ Error obteniendo subcarpetas existentes:', subError)
        return
      }
      const existingTipos = new Set((existingSubFolders || []).map(sf => sf.tipo_extension))

      // Extensiones activas del usuario
      const { data: userExts, error: userExtsError } = await supabase
        .from('plan_extensiones')
        .select(`*, extensiones (id, name, name_es, service_type)`) 
        .eq('user_id', user.id)
      if (userExtsError) {
        console.error('❌ Error obteniendo extensiones del usuario:', userExtsError)
        return
      }

      const activeTypes = new Set(['brify'])
      for (const ue of (userExts || [])) {
        const ext = ue.extensiones || {}
        const name = (ext.name_es || ext.name || '').toLowerCase()
        const type = (ext.type || '').toLowerCase()
        if (name === 'abogados' || type === 'abogados' || type === 'lawyers') activeTypes.add('abogados')
        if (name === 'entrenador' || type === 'entrenador' || type === 'trainer') activeTypes.add('entrenador')
        if (name === 'veterinarios' || type === 'veterinarios' || type === 'veterinarians') activeTypes.add('veterinarios')
      }

      const desired = []
      if (activeTypes.has('brify') && !existingTipos.has('brify')) desired.push({ nombre: 'Brify', tipo: 'brify' })
      if (activeTypes.has('abogados') && !existingTipos.has('abogados')) desired.push({ nombre: 'Abogados', tipo: 'abogados' })
      if (activeTypes.has('entrenador') && !existingTipos.has('entrenador')) desired.push({ nombre: 'Entrenador', tipo: 'entrenador' })
      if (activeTypes.has('veterinarios') && !existingTipos.has('veterinarios')) desired.push({ nombre: 'Veterinarios', tipo: 'veterinarios' })

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
            const { error: createError } = await db.subCarpetasAdministrador.create(subFolderData)
            if (createError) {
              console.error(`❌ Error registrando subcarpeta ${subFolder.nombre}:`, createError)
            } else {
              console.log(`✅ Subcarpeta ${subFolder.nombre} creada vía reconciliación en Folders`)
            }
          }
        } catch (e) {
          console.error(`❌ Error creando subcarpeta faltante ${subFolder.nombre}:`, e)
        }
      }

      // Evitar ejecuciones múltiples y refrescar lista de subcarpetas disponibles
      setRanEnsureOnce(true)
      await loadAvailableSubFolders()
    } catch (e) {
      console.error('❌ Error asegurando subcarpetas de extensiones (Folders):', e)
    }
  }

  // Ejecutar reconciliación una sola vez cuando haya plan activo
  useEffect(() => {
    if (!ranEnsureOnce && hasActivePlan) {
      ensureAdminSubFoldersForUser()
    }
  }, [ranEnsureOnce, hasActivePlan, user])

  // Cargar automáticamente la carpeta administrador por defecto
  const loadAdminFolderByDefault = async () => {
    try {
      setLoading(true)
      
      // Obtener la carpeta administrador del usuario
      const { data: adminData, error: adminError } = await db.adminFolders.getByUser(user.id)
      if (adminError) throw adminError
      
      if (adminData && adminData.length > 0) {
        const adminFolder = adminData[0]
        // Establecer la carpeta administrador como carpeta actual
        setCurrentFolder({
          ...adminFolder,
          folder_name: 'Master - Brify',
          google_folder_id: adminFolder.id_drive_carpeta,
          type: 'admin'
        })
        setBreadcrumb([
          { name: 'Inicio', id: null },
          { name: 'Master - Brify', id: adminFolder.id }
        ])
        
        // Cargar las carpetas de usuario dentro de la carpeta administrador
        await loadFolders(adminFolder.id_drive_carpeta)
      } else {
        // Si no hay carpeta administrador, cargar vista normal
        await loadFolders()
      }
    } catch (error) {
      console.error('Error loading admin folder by default:', error)
      // En caso de error, cargar vista normal
      await loadFolders()
    }
  }

  const loadFolders = async (parentId = null) => {
    try {
      setLoading(true)
      
      let dbFolders = []
      
      if (parentId) {
        // Si estamos dentro de una carpeta, cargar subcarpetas (carpetas de usuario y grupos)
        
        // Cargar carpetas de usuario
        const { data: userFoldersData, error: userFoldersError } = await supabase
          .from('carpetas_usuario')
          .select('*')
          .eq('administrador', user.email)
        
        if (userFoldersError) throw userFoldersError
        
        const userFolders = (userFoldersData || []).map(folder => ({
          ...folder,
          folder_name: folder.nombre_carpeta || folder.correo,
          google_folder_id: folder.id_carpeta_drive,
          shared_email: folder.correo,
          type: 'user',
          synced: true
        }))
        
        // Cargar grupos drive
        const { data: groupsData, error: groupsError } = await supabase
          .from('grupos_drive')
          .select('*')
          .eq('administrador', user.email)
        
        if (groupsError) throw groupsError
        
        const groupFolders = (groupsData || []).map(folder => ({
          ...folder,
          folder_name: folder.group_name || folder.nombre_grupo_low,
          google_folder_id: folder.folder_id,
          shared_email: 'Grupo compartido',
          type: 'group',
          synced: true
        }))
        
        dbFolders = [...userFolders, ...groupFolders]
      } else {
        // Cargar carpeta administrador y todas las carpetas
        const { data: adminData, error: adminError } = await db.adminFolders.getByUser(user.id)
        if (adminError) throw adminError
        
        // Cargar carpetas de usuario
        const { data: userFoldersData, error: userFoldersError } = await supabase
          .from('carpetas_usuario')
          .select('*')
          .eq('administrador', user.email)
        
        if (userFoldersError) throw userFoldersError
        
        // Cargar grupos drive
        const { data: groupsData, error: groupsError } = await supabase
          .from('grupos_drive')
          .select('*')
          .eq('administrador', user.email)
        
        if (groupsError) throw groupsError
        
        // Combinar todas las carpetas
        const adminFolders = (adminData || []).map(folder => ({
          ...folder,
          folder_name: 'Master - Brify',
          google_folder_id: folder.id_drive_carpeta,
          shared_email: 'Carpeta administrador',
          type: 'admin',
          synced: true
        }))
        
        const userFolders = (userFoldersData || []).map(folder => ({
          ...folder,
          folder_name: folder.nombre_carpeta || folder.correo,
          google_folder_id: folder.id_carpeta_drive,
          shared_email: folder.correo,
          type: 'user',
          synced: true
        }))
        
        const groupFolders = (groupsData || []).map(folder => ({
          ...folder,
          folder_name: folder.group_name || folder.nombre_grupo_low,
          google_folder_id: folder.folder_id,
          shared_email: 'Grupo compartido',
          type: 'group',
          synced: true
        }))
        
        dbFolders = [...adminFolders, ...userFolders, ...groupFolders]
      }
      
      // Si el usuario tiene Google Drive conectado, sincronizar con Drive
      if (userProfile?.google_refresh_token) {
        try {
          const tokenSet = await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          
          if (!tokenSet) {
            console.error('Failed to set Google Drive tokens')
            setFolders(dbFolders)
            return
          }
          
          // Obtener carpetas de Google Drive
          const driveFolders = await googleDriveService.listFiles(parentId, 'folder')
          
          // Combinar información de DB y Drive
          const combinedFolders = dbFolders.map(dbFolder => {
            const driveFolder = (driveFolders && Array.isArray(driveFolders)) 
              ? driveFolders.find(df => df.id === dbFolder.google_folder_id)
              : null
            return {
              ...dbFolder,
              driveInfo: driveFolder,
              synced: !!driveFolder
            }
          })
          
          setFolders(combinedFolders)
        } catch (error) {
          console.error('Error syncing with Google Drive:', error)
          setFolders(dbFolders.map(folder => ({ ...folder, synced: false })))
        }
      } else {
        setFolders(dbFolders.map(folder => ({ ...folder, synced: false })))
      }
      
    } catch (error) {
      console.error('Error loading folders:', error)
      toast.error('Error cargando las carpetas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('El nombre de la carpeta es requerido')
      return
    }
    
    // Validaciones específicas según el tipo de extensión
    if (selectedParentFolder) {
      const extension = selectedParentFolder.tipo_extension
      
      if (extension === 'entrenador' && folderType === 'Alumno') {
        if (!isValidEmail(newFolderName)) {
          toast.error('Para alumnos, debes ingresar un email válido')
          return
        }
      }
    } else {
      // Sin carpeta padre seleccionada, requiere email válido
      if (!isValidEmail(newFolderName)) {
        toast.error('Debes ingresar un email válido')
        return
      }
    }

    // Evitar crear subcarpetas - solo permitir creación en el nivel principal
    if (currentFolder && currentFolder.type === 'user') {
      toast.error('No se pueden crear subcarpetas dentro de carpetas de usuario')
      return
    }

    setCreating(true)
    
    try {
      // Obtener la carpeta administrador del usuario
      const { data: adminFolder, error: adminError } = await db.adminFolders.getByEmail(user.email)
      
      if (adminError || !adminFolder || adminFolder.length === 0) {
        toast.error('No se encontró la carpeta administrador. Debes tener un plan activo.')
        setCreating(false)
        return
      }
      
      const adminFolderData = adminFolder[0]
      let googleFolderId = null
      
      // Si tiene Google Drive conectado, crear la carpeta en Drive
      if (userProfile?.google_refresh_token) {
        try {
          const tokenSet = await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          
          if (!tokenSet) {
            toast.error('Error inicializando Google Drive')
            setCreating(false)
            return
          }
          
          // Determinar la carpeta padre según la selección
          let parentFolderId = adminFolderData.id_drive_carpeta // Por defecto, carpeta Master - Brify
          
          if (selectedParentFolder && selectedParentFolder.file_id_subcarpeta) {
            parentFolderId = selectedParentFolder.file_id_subcarpeta // Usar subcarpeta seleccionada
          }
          
          // Crear carpeta en Google Drive dentro de la carpeta padre seleccionada
          const driveFolder = await googleDriveService.createFolder(
            newFolderName,
            parentFolderId
          )
          
          googleFolderId = driveFolder.id
          
          // Determinar el email para compartir
          let emailToShare = null
          if (selectedParentFolder) {
            const extension = selectedParentFolder.tipo_extension
            
            if (extension === 'entrenador' && folderType === 'Alumno') {
              emailToShare = newFolderName // Para alumnos, el nombre es el email
            } else if ((extension === 'brify' || extension === 'abogados' || (extension === 'entrenador' && folderType === 'Normal')) && newFolderEmail.trim()) {
              emailToShare = newFolderEmail // Email opcional para grupos
            }
          } else {
            emailToShare = newFolderName // Comportamiento por defecto
          }
          
          // Compartir la carpeta si hay email
          if (emailToShare) {
            await googleDriveService.shareFolder(googleFolderId, emailToShare)
            toast.success(`Carpeta creada y compartida con ${emailToShare}`)
          } else {
            toast.success('Carpeta creada exitosamente')
          }
        } catch (error) {
          console.error('Error creating folder in Google Drive:', error)
          toast.error('Error creando la carpeta en Google Drive')
          return
        }
      }
      
      // Determinar la extensión basada en la carpeta padre seleccionada
      let extension = 'Brify' // Por defecto
      console.log('🎯 Carpeta padre seleccionada para determinar extensión:', selectedParentFolder)
      
      if (selectedParentFolder) {
        if (selectedParentFolder.tipo_extension) {
          // Mapear tipo_extension a nombre de extensión correcto
          const extensionMapping = {
            'brify': 'Brify',
            'entrenador': 'Entrenador',
            'abogados': 'Abogados',
            'veterinarios': 'Veterinarios'
          }
          extension = extensionMapping[selectedParentFolder.tipo_extension] || selectedParentFolder.tipo_extension
          console.log(`📋 Extensión determinada por tipo_extension: ${selectedParentFolder.tipo_extension} -> ${extension}`)
        } else if (selectedParentFolder.nombre_subcarpeta) {
          // Extraer extensión del nombre de la subcarpeta como fallback
          const nombreLower = selectedParentFolder.nombre_subcarpeta.toLowerCase()
          if (nombreLower.includes('entrenador')) {
            extension = 'Entrenador'
          } else if (nombreLower.includes('abogado')) {
            extension = 'Abogados'
          } else if (nombreLower.includes('veterinario')) {
            extension = 'Veterinarios'
          } else if (nombreLower.includes('brify')) {
            extension = 'Brify'
          }
          console.log(`📋 Extensión determinada por nombre_subcarpeta: ${selectedParentFolder.nombre_subcarpeta} -> ${extension}`)
        }
      }
      
      console.log(`✅ Extensión final asignada: ${extension}`)
      
      // Determinar el tipo de registro según la extensión y configuración
      let shouldUseGruposDrive = false
      let shouldUseUserFolders = true
      
      if (selectedParentFolder) {
        const ext = selectedParentFolder.tipo_extension
        
        if (ext === 'brify' || ext === 'abogados') {
          // Para Brify y Abogados siempre usar grupos_drive
          shouldUseGruposDrive = true
          shouldUseUserFolders = false
        } else if (ext === 'entrenador') {
          if (folderType === 'Normal') {
            // Para Entrenador Normal usar grupos_drive
            shouldUseGruposDrive = true
            shouldUseUserFolders = false
          }
          // Para Entrenador Alumno usar carpetas_usuario (por defecto)
        }
      }
      
      console.log(`📊 Tipo de registro: grupos_drive=${shouldUseGruposDrive}, carpetas_usuario=${shouldUseUserFolders}`)
      
      // Registrar en grupos_drive si corresponde
      if (shouldUseGruposDrive) {
        const grupoData = {
          owner_id: user.id,
          group_name: newFolderName,
          folder_id: googleFolderId,
          administrador: user.email,
          extension: extension,
          nombre_grupo_low: newFolderName.toLowerCase()
        }
        
        console.log('💾 Datos de grupo a guardar en grupos_drive:', grupoData)
        
        const { error: grupoError } = await db.gruposDrive.create(grupoData)
        
        if (grupoError) {
          console.error('Error saving group to grupos_drive:', grupoError)
          toast.error('Error guardando el grupo')
          return
        }
        
        // Si hay email para compartir, registrar en grupos_carpetas
        const emailToRegister = selectedParentFolder.tipo_extension === 'entrenador' && folderType === 'Normal' ? newFolderEmail : newFolderEmail
        
        if (emailToRegister && emailToRegister.trim()) {
          const carpetaData = {
            user_id: user.id,
            role: 'lector',
            carpeta_id: googleFolderId,
            administrador: user.email,
            usuario_lector: emailToRegister
          }
          
          console.log('💾 Datos de carpeta compartida a guardar en grupos_carpetas:', carpetaData)
          
          const { error: carpetaError } = await db.gruposCarpetas.create(carpetaData)
          
          if (carpetaError) {
            console.error('Error saving shared folder to grupos_carpetas:', carpetaError)
            // No fallar la creación, solo mostrar advertencia
            toast.error('Grupo creado pero error registrando el acceso compartido')
          }
        }
      }
      
      // Registrar en carpetas_usuario si corresponde
      if (shouldUseUserFolders) {
        const folderData = {
          telegram_id: userProfile?.telegram_id || null,
          correo: newFolderName, // El nombre de la carpeta será el correo
          id_carpeta_drive: googleFolderId,
          administrador: user.email, // Email del administrador que crea la carpeta
          extension: extension // Campo para identificar la extensión
        }
        
        console.log('💾 Datos de carpeta a guardar en carpetas_usuario:', folderData)
        
        const { error } = await db.userFolders.create(folderData)
        
        if (error) {
          console.error('Error saving folder to database:', error)
          toast.error('Error guardando la carpeta')
          return
        }
      }
      
      // Crear usuario automáticamente en la tabla users solo para carpetas de tipo "Alumno" o flujo tradicional
      if (shouldUseUserFolders) {
        try {
          // Verificar si el usuario ya existe
          const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('email', newFolderName)
            .single()
          
          if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking existing user:', checkError)
          }
          
          // Si el usuario no existe, crearlo
          if (!existingUser) {
            // Extraer el nombre del email (parte antes del @)
            const nameFromEmail = newFolderName.split('@')[0]
            
            const userData = {
              email: newFolderName,
              name: nameFromEmail,
              cliente: true, // Marcar como cliente
              is_active: true,
              registered_via: 'folder_creation',
              used_storage_bytes: 0,
              admin: false,
              onboarding_status: 'completed'
            }
            
            const { error: userError } = await supabase
              .from('users')
              .insert([userData])
            
            if (userError) {
              console.error('Error creating user:', userError)
              // No fallar la creación de carpeta si falla la creación del usuario
              toast.error('Carpeta creada pero error creando usuario automático')
            } else {
              console.log('Usuario creado automáticamente:', newFolderName)
              
              // Enviar correo de bienvenida
              try {
                const result = await emailService.sendWelcomeEmail(newFolderName, nameFromEmail, user.id, extension)
                if (result.success) {
                  console.log('Correo de bienvenida enviado exitosamente')
                  toast.success(`Carpeta creada, usuario registrado y correo de bienvenida enviado a ${newFolderName}`)
                } else {
                  console.error('Error enviando correo de bienvenida:', result.error)
                  toast.success(`Carpeta creada y usuario registrado. Error enviando correo de bienvenida.`)
                }
              } catch (emailError) {
                console.error('Error en servicio de email:', emailError)
                toast.success(`Carpeta creada y usuario registrado. Error enviando correo de bienvenida.`)
              }
            }
          } else {
            console.log('Usuario ya existe:', newFolderName)
            // Enviar correo de bienvenida también para usuarios existentes
            try {
              const nameFromEmail = newFolderName.split('@')[0]
              const result = await emailService.sendWelcomeEmail(newFolderName, nameFromEmail, user.id, extension)
              if (result.success) {
                console.log('Correo de bienvenida enviado a usuario existente')
                toast.success(`Carpeta creada y correo de bienvenida enviado a ${newFolderName}`)
              } else {
                console.error('Error enviando correo de bienvenida:', result.error)
                toast.success(`Carpeta creada exitosamente`)
              }
            } catch (emailError) {
              console.error('Error en servicio de email:', emailError)
              toast.success(`Carpeta creada exitosamente`)
            }
          }
        } catch (userCreationError) {
          console.error('Error in user creation process:', userCreationError)
          // No fallar la creación de carpeta si falla la creación del usuario
          toast.success('Carpeta creada exitosamente')
        }
      } else {
        // Para carpetas de tipo "Normal" en grupos, mostrar mensaje de éxito simple
        toast.success('Carpeta creada exitosamente')
      }
      
      // Recargar carpetas
      await loadFolders(currentFolder?.id)
      
      // Limpiar formulario
      setNewFolderName('')
      setNewFolderEmail('')
      setFolderType('Alumno')
      setShowCreateModal(false)
      
      // No mostrar mensaje genérico ya que se muestran mensajes específicos arriba
      
    } catch (error) {
      console.error('Error creating folder:', error)
      toast.error('Error creando la carpeta')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la carpeta "${folder.name}"?`)) {
      return
    }
    
    try {
      // Eliminar de Google Drive si existe
      if (folder.google_folder_id && userProfile?.google_refresh_token) {
        try {
          await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          await googleDriveService.deleteFile(folder.google_folder_id)
        } catch (error) {
          console.error('Error deleting from Google Drive:', error)
        }
      }
      
      // Eliminar de la base de datos
      const { error } = currentFolder
        ? await db.userFolders.delete(folder.id)
        : await db.adminFolders.delete(folder.id)
      
      if (error) {
        console.error('Error deleting folder from database:', error)
        toast.error('Error eliminando la carpeta')
        return
      }
      
      // Eliminar usuario correspondiente de la tabla users si es una carpeta de usuario
      if (currentFolder && folder.type === 'user') {
        try {
          // Buscar el usuario por email (que corresponde al nombre de la carpeta)
          const folderEmail = folder.folder_name || folder.correo
          
          if (folderEmail) {
            const { error: deleteUserError } = await supabase
              .from('users')
              .delete()
              .eq('email', folderEmail)
              .eq('cliente', true) // Solo eliminar usuarios marcados como cliente
            
            if (deleteUserError) {
              console.error('Error deleting user:', deleteUserError)
              // No fallar la eliminación de carpeta si falla la eliminación del usuario
              toast.error('Carpeta eliminada pero error eliminando usuario automático')
            } else {
              console.log('Usuario eliminado automáticamente:', folderEmail)
            }
          }
        } catch (userDeletionError) {
          console.error('Error in user deletion process:', userDeletionError)
          // No fallar la eliminación de carpeta si falla la eliminación del usuario
        }
      }
      
      // Recargar carpetas
      await loadFolders(currentFolder?.id)
      toast.success('Carpeta eliminada exitosamente')
      
    } catch (error) {
      console.error('Error deleting folder:', error)
      toast.error('Error eliminando la carpeta')
    }
  }

  const handleFolderClick = (folder) => {
    // Redirigir a la pestaña de archivos con la carpeta seleccionada
    if (folder.type === 'user') {
      // Navegar a la pestaña de archivos con la carpeta preseleccionada
      navigate('/files', { 
        state: { 
          selectedFolder: {
            ...folder,
            id: folder.google_folder_id // Usar google_folder_id como id para el filtrado
          },
          folderId: folder.google_folder_id,
          folderName: folder.folder_name
        } 
      })
    }
  }



  const handleBreadcrumbClick = (index) => {
    // Prevenir navegación fuera de la carpeta administrador (índice 0 es "Inicio", índice 1 es "Entrenador - Brify")
    if (index < 1) {
      return // No permitir ir más atrás que la carpeta administrador
    }
    
    const newBreadcrumb = breadcrumb.slice(0, index + 1)
    const targetFolder = newBreadcrumb[newBreadcrumb.length - 1]
    
    setBreadcrumb(newBreadcrumb)
    
    if (index === 1) {
      // Volver a la carpeta administrador - recargar la vista completa
      loadAdminFolderByDefault()
    } else {
      // Navegar a una subcarpeta específica - mostrar vista vacía
      setFolders([])
      const folder = { google_folder_id: targetFolder.id, folder_name: targetFolder.name, type: 'user' }
      setCurrentFolder(folder)
    }
  }

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const filteredFolders = folders.filter(folder =>
    folder.folder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    folder.shared_email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!hasActivePlan()) {
    return (
      <div className="text-center py-12">
        <FolderIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Plan Requerido
        </h3>
        <p className="text-gray-600 mb-6">
          Necesitas un plan activo para acceder a la gestión de carpetas.
        </p>
        <button
          onClick={() => window.location.href = '/plans'}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          Ver Planes
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg">
              <FolderIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestión de Archivos y Carpetas</h1>
              <p className="text-gray-600 mt-1">
                Organiza tus documentos y carpetas
              </p>
            </div>
          </div>
          
          {/* Botones de acción según el tab activo */}
          <div className="flex space-x-3 mt-4 sm:mt-0">
            {/* Botón de sincronización Drive - siempre visible */}
            <button
              onClick={handleSyncDrive}
              disabled={syncing}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 text-white ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronización Drive'}
            </button>

            {activeTab === 'folders' && (!currentFolder || currentFolder.type !== 'user') && (
              <button
                onClick={() => {
                      loadAvailableSubFolders()
                      setShowCreateModal(true)
                    }}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
              >
                <PlusIcon className="h-5 w-5 mr-2 text-white" />
                Nueva Carpeta
              </button>
            )}
            
            {activeTab === 'files' && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
                >
                  <CloudArrowUpIcon className="h-5 w-5 mr-2 text-white" />
                  Subir Archivos
                </button>
                
                {hasExtension('Entrenador') && (
                  <button
                    onClick={() => setShowRoutineUpload(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
                  >
                    <DocumentTextIcon className="h-5 w-5 mr-2 text-white" />
                    Subir Rutina
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('folders')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'folders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FolderIcon className="h-5 w-5" />
                <span>Gestión de Carpetas</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('files')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'files'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <DocumentIcon className="h-5 w-5" />
                <span>Gestión de Archivos</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Input oculto para archivos */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Contenido según tab activo */}
        {activeTab === 'folders' ? (
          <>
            {/* Breadcrumb */}
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              {breadcrumb.map((item, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && (
                    <svg className="flex-shrink-0 h-4 w-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`text-sm font-medium ${
                      index === breadcrumb.length - 1
                        ? 'text-gray-500 cursor-default'
                        : 'text-primary-600 hover:text-primary-700'
                    }`}
                    disabled={index === breadcrumb.length - 1}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {/* Subcarpetas disponibles */}
          {availableSubFolders.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Subcarpetas disponibles</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableSubFolders.map((subfolder) => (
                  <div
                    key={subfolder.id}
                    className="flex items-center p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-sm"
                  >
                    <FolderIcon className="h-4 w-4 text-blue-500 mr-2" />
                    <span className="text-sm text-gray-700 truncate font-medium">
                      {subfolder.nombre_subcarpeta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-8">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar carpetas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>

          {/* Folders Grid */}
          {loading ? (
            <LoadingSpinner text="Cargando carpetas..." />
          ) : filteredFolders.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {searchTerm ? 'No se encontraron carpetas' : 'No hay carpetas'}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Crea tu primera carpeta para comenzar'
                }
              </p>
              {!searchTerm && (
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      loadAvailableSubFolders()
                      setShowCreateModal(true)
                    }}
                    className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                    title="Crear Primera Carpeta"
                  >
                    <PlusIcon className="h-6 w-6 text-white" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredFolders.map((folder) => {
                
                return (
                <div
                  key={folder.id}
                  className="bg-white border border-gray-200 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 p-6 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-500 rounded-2xl shadow-sm mr-4">
                        <FolderIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate text-lg">
                          {folder.folder_name}
                        </h3>
                        <div className="flex items-center mt-2">
                          <div className={`w-2.5 h-2.5 rounded-full mr-2 ${
                            folder.synced ? 'bg-green-500' : 'bg-yellow-500'
                          }`} />
                          <span className="text-sm text-gray-600 font-medium">
                            {folder.synced ? 'Sincronizado' : 'Solo local'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDeleteFolder(folder)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Eliminar carpeta"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm text-gray-600 mb-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 rounded-lg mr-3">
                        <UserIcon className="h-4 w-4 text-gray-600" />
                      </div>
                      <span className="truncate font-medium">{folder.shared_email}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 rounded-lg mr-3">
                        <CalendarIcon className="h-4 w-4 text-gray-600" />
                      </div>
                      <span>Creada: {formatDate(folder.created_at)}</span>
                    </div>
                    {folder.extension && (
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          folder.extension === 'Abogados' ? 'bg-green-500' :
                          folder.extension === 'Entrenador' ? 'bg-purple-500' :
                          'bg-orange-500'
                        }`} />
                        <span className="text-xs font-semibold text-gray-700">
                          Extensión: {folder.extension}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleFolderClick(folder)}
                    className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center"
                  >
                    <DocumentIcon className="h-4 w-4 mr-2" />
                    Ver archivos
                  </button>

                </div>
                )
              })}
            </div>
          )}
          </>
        ) : (
          /* Contenido de gestión de archivos */
          <div className="space-y-6">
            {/* Filtros para archivos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carpeta
                </label>
                <select
                  value={selectedFileFolder}
                  onChange={(e) => setSelectedFileFolder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
              </div>
            </div>

            {/* Search para archivos */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar archivos..."
                value={fileSearchTerm}
                onChange={(e) => setFileSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Drag & Drop Upload */}
            {showDragDropUpload ? (
              <DragDropUpload
                onFilesSelected={handleFileSelect}
                onUpload={handleUpload}
                selectedFolder={selectedFileFolder}
                folders={folders}
                onFolderChange={setSelectedFileFolder}
                uploading={uploading}
                uploadProgress={uploadProgress}
                acceptedTypes=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              />
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-green-800 mb-2">
                  ¡Archivos subidos exitosamente!
                </h3>
                <p className="text-green-600">
                  El área de subida se mostrará nuevamente en unos segundos...
                </p>
              </div>
            )}

            {/* Files List */}
            {loading ? (
              <LoadingSpinner text="Cargando archivos..." />
            ) : filteredAndSortedFiles.length === 0 ? (
              <div className="text-center py-12">
                <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {fileSearchTerm || fileTypeFilter !== 'all' ? 'No se encontraron archivos' : 'No hay archivos'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {fileSearchTerm || fileTypeFilter !== 'all'
                    ? 'Intenta con otros filtros de búsqueda'
                    : 'Sube tu primer archivo para comenzar'
                  }
                </p>
                {!fileSearchTerm && fileTypeFilter === 'all' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
                                {file.google_file_id && (
                                  <a
                                    href={`https://drive.google.com/file/d/${file.google_file_id}/view`}
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
                                    className="text-blue-600 hover:text-blue-700 p-1"
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
          </div>
        )}
       
        {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mr-4">
                <PlusIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Crear Nueva Carpeta
              </h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Carpeta padre
                </label>
                <select
                  value={selectedParentFolder?.id || ''}
                  onChange={(e) => {
                    console.log('🔄 Cambiando carpeta padre a:', e.target.value)
                    if (e.target.value === '') {
                      console.log('📁 Carpeta seleccionada: null (ninguna)')
                      setSelectedParentFolder(null)
                    } else {
                      const selectedId = parseInt(e.target.value)
                      const selected = availableSubFolders.find(folder => folder.id === selectedId)
                      console.log('📁 Carpeta seleccionada:', selected)
                      setSelectedParentFolder(selected)
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Selecciona una carpeta padre</option>
                  {availableSubFolders.map((folder) => {
                    console.log('🎯 Renderizando opción:', folder)
                    return (
                      <option key={folder.id} value={folder.id}>
                        {folder.nombre_subcarpeta}
                      </option>
                    )
                  })}
                </select>
                <p className="text-sm text-gray-600 mt-2">
                  Selecciona donde crear la nueva carpeta
                </p>
              </div>

              {/* Mostrar campos según la extensión seleccionada */}
              {selectedParentFolder && (
                <>
                  {/* Para Brify y Abogados: Input de nombre + email opcional */}
                  {(selectedParentFolder.tipo_extension === 'brify' || selectedParentFolder.tipo_extension === 'abogados') && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          Nombre de la carpeta *
                        </label>
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Nombre del grupo o proyecto"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                          Nombre que tendrá la carpeta del grupo
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          Email para compartir (opcional)
                        </label>
                        <input
                          type="email"
                          value={newFolderEmail}
                          onChange={(e) => setNewFolderEmail(e.target.value)}
                          placeholder="usuario@ejemplo.com"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                          Si proporcionas un email, la carpeta se compartirá automáticamente
                        </p>
                      </div>
                    </>
                  )}

                  {/* Para Entrenador: Selector de tipo + campos correspondientes */}
                  {selectedParentFolder.tipo_extension === 'entrenador' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          Tipo de carpeta
                        </label>
                        <select
                          value={folderType}
                          onChange={(e) => setFolderType(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="Alumno">Alumno</option>
                          <option value="Normal">Normal</option>
                        </select>
                        <p className="text-sm text-gray-600 mt-2">
                          Alumno: registro individual | Normal: registro de grupo
                        </p>
                      </div>

                      {folderType === 'Alumno' ? (
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-3">
                            Email del alumno *
                          </label>
                          <input
                            type="email"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="alumno@ejemplo.com"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          />
                          <p className="text-sm text-gray-600 mt-2">
                            El email será usado como nombre de carpeta y se compartirá automáticamente
                          </p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                              Nombre del grupo *
                            </label>
                            <input
                              type="text"
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              placeholder="Nombre del grupo de entrenamiento"
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            />
                            <p className="text-sm text-gray-600 mt-2">
                              Nombre que tendrá la carpeta del grupo
                            </p>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                              Email para compartir (opcional)
                            </label>
                            <input
                              type="email"
                              value={newFolderEmail}
                              onChange={(e) => setNewFolderEmail(e.target.value)}
                              placeholder="entrenador@ejemplo.com"
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            />
                            <p className="text-sm text-gray-600 mt-2">
                              Si proporcionas un email, la carpeta se compartirá automáticamente
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Fallback para cuando no hay carpeta padre seleccionada */}
              {!selectedParentFolder && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Email del cliente
                  </label>
                  <input
                    type="email"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    El email será usado como nombre de carpeta y se compartirá automáticamente
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex space-x-4 mt-8">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewFolderName('')
                  setNewFolderEmail('')
                  setFolderType('Alumno')
                }}
                className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-xl transition-colors"
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creating || !newFolderName.trim() || (selectedParentFolder && selectedParentFolder.tipo_extension === 'entrenador' && folderType === 'Alumno' && !isValidEmail(newFolderName)) || (!selectedParentFolder && !isValidEmail(newFolderName))}
                className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <PlusIcon className="h-5 w-5 mr-2 text-white" />
                {creating ? 'Creando...' : 'Crear Carpeta'}
              </button>
            </div>
          </div>
        </div>
      )}
       </div>
     </div>
   )
}

export default Folders