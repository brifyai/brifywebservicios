import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import fileContentExtractor from '../../services/fileContentExtractor'
import embeddingService from '../../services/embeddingService'
import { useUserExtensions } from '../../hooks/useUserExtensions'
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
import RoutineUpload from '../routines/RoutineUpload'
import DragDropUpload from '../common/DragDropUpload'
import toast from 'react-hot-toast'

const Files = () => {
  const { user, userProfile, hasActivePlan } = useAuth()
  const { hasExtension } = useUserExtensions()
  const location = useLocation()
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [showRoutineUpload, setShowRoutineUpload] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDragDropUpload, setShowDragDropUpload] = useState(true)
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
    } else {
      // Si no hay carpeta seleccionada, cargar todos los archivos
      loadFiles()
    }
  }, [selectedFolder])

  // Manejar carpeta preseleccionada desde navegación
  useEffect(() => {
    if (location.state?.selectedFolder) {
      const folder = location.state.selectedFolder
      setSelectedFolder(folder.id.toString())
      toast.success(`Carpeta "${folder.folder_name}" seleccionada`)
    }
  }, [location.state])

  const loadFolders = async () => {
    try {
      // Cargar carpetas del administrador
      const { data: adminFolders, error: adminError } = await db.adminFolders.getByUser(user.id)
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
      
      console.log('Admin folders:', adminFolders)
      console.log('User folders:', userFoldersData)
      console.log('Groups folders:', groupsData)
      console.log('Current user:', user)
      
      const allFolders = [
        ...(adminFolders || []).map(f => ({ 
          ...f, 
          id: f.id_drive_carpeta, // Usar id_drive_carpeta como id principal
          type: 'admin',
          folder_name: 'Master - Brify',
          google_folder_id: f.id_drive_carpeta,
          correo: f.correo || user.email
        })),
        ...(userFoldersData || []).map(f => ({ 
          ...f, 
          id: f.id_carpeta_drive, // Usar id_carpeta_drive como id principal
          type: 'user',
          folder_name: f.nombre_carpeta || f.correo,
          google_folder_id: f.id_carpeta_drive,
          correo: f.correo
        })),
        ...(groupsData || []).map(f => ({ 
          ...f, 
          id: f.folder_id, // Usar folder_id como id principal
          type: 'drive',
          folder_name: f.group_name || f.nombre_grupo_low,
          google_folder_id: f.folder_id,
          correo: f.group_name || f.nombre_grupo_low
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
          file_id: file.file_id, // ID de Google Drive
          source: 'documentos_administrador',
          correo: file.administrador,
          service_type: 'Admin'
        },
        // Agregar campos adicionales para compatibilidad
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
      
      // Si hay un folderId seleccionado, filtrar por usuario que corresponda a esa carpeta
      if (folderId) {
        // Buscar la carpeta seleccionada para obtener el correo/usuario asociado
        const selectedFolderData = folders.find(folder => folder.id === folderId)
        if (selectedFolderData) {
          // Filtrar archivos por el usuario que corresponde a la carpeta seleccionada
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
          file_id: file.file_id, // ID de Google Drive
          source: 'documentos_usuario_entrenador',
          correo: file.usuario,
          service_type: 'Usuario'
        },
        // Agregar campos adicionales para compatibilidad
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
          
          // Enriquecer archivos con información de Google Drive
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

  // Tipos de archivo permitidos
  const allowedFileTypes = {
    // Documentos PDF
    'application/pdf': '.pdf',
    // Documentos Word
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    // Documentos Excel
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    // Documentos PowerPoint (opcional)
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    // Documentos de texto
    'text/plain': '.txt'
  }

  // Extensiones bloqueadas
  const blockedExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.dll',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    '.js', '.vbs', '.ps1', '.sh'
  ]

  const validateFileType = (file) => {
    const fileName = file.name.toLowerCase()
    const fileType = file.type
    
    // Verificar extensiones bloqueadas
    const hasBlockedExtension = blockedExtensions.some(ext => fileName.endsWith(ext))
    if (hasBlockedExtension) {
      return {
        valid: false,
        reason: `Archivo ${file.name}: Tipo de archivo no permitido por seguridad`
      }
    }
    
    // Verificar tipos MIME permitidos
    if (fileType && allowedFileTypes[fileType]) {
      return { valid: true }
    }
    
    // Verificar por extensión si el MIME type no está disponible
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
    // Manejar tanto eventos de input como arrays de archivos directos
    const files = Array.isArray(event) ? event : Array.from(event.target.files)
    
    // Validar cada archivo
    const validationResults = files.map(validateFileType)
    const invalidFiles = validationResults.filter(result => !result.valid)
    
    if (invalidFiles.length > 0) {
      // Mostrar errores para archivos no válidos
      invalidFiles.forEach(result => {
        toast.error(result.reason)
      })
      
      // Solo mantener archivos válidos
      const validFiles = files.filter((file, index) => validationResults[index].valid)
      
      if (validFiles.length === 0) {
        // Si no hay archivos válidos, limpiar la selección
        event.target.value = ''
        return
      }
      
      setSelectedFiles(validFiles)
      toast.success(`${validFiles.length} archivo(s) válido(s) seleccionado(s)`)
    } else {
      setSelectedFiles(files)
      toast.success(`${files.length} archivo(s) seleccionado(s)`)
    }
    
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
            console.log('🔄 Subiendo archivo a Google Drive...')
            const driveFile = await googleDriveService.uploadFile(
              file,
              folder.google_folder_id,
              (progress) => {
                newUploadProgress[fileId] = progress
                setUploadProgress({ ...newUploadProgress })
              }
            )
            googleFileId = driveFile.id
            console.log('✅ Archivo subido a Google Drive con ID:', googleFileId)
          } else {
            // Generar un ID único para el archivo cuando no se sube a Google Drive
            googleFileId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            console.log('📁 Generado ID local para archivo:', googleFileId)
          }
          
          console.log('🔍 googleFileId antes del procesamiento:', googleFileId)
          
          // Extraer contenido y procesar con chunking inteligente
          let content = ''
          let embedding = []
          let tokensUsed = 0
          
          console.log('🔍 googleFileId antes del try-catch de extracción:', googleFileId)
          
          try {
            if (fileContentExtractor.isSupported(file)) {
              const processed = await embeddingService.processFile(file, fileContentExtractor)
              content = processed.content
              embedding = processed.embedding
              console.log(`✅ Contenido extraído: ${content.length} caracteres`)
              
              // Actualizar progreso después de extraer contenido
              newUploadProgress[fileId] = 20
              setUploadProgress({ ...newUploadProgress })
              
              // Calcular tokens reales basados en el contenido
              tokensUsed = Math.ceil(content.length / 4) // Aproximación estándar para tokens
              
              // Registrar uso de tokens usando el sistema correcto
              const embeddingsServiceLib = await import('../../lib/embeddings')
              await embeddingsServiceLib.default.trackTokenUsage(user.id, tokensUsed, 'file_embedding')
              
            } else {
              console.warn(`⚠️ Tipo de archivo no soportado: ${file.type}`)
              // Abortar el proceso para archivos no soportados
              throw new Error(`Formato de archivo no compatible: ${file.type}. Solo se permiten documentos de texto, PDF, Word y Excel.`)
            }
          } catch (extractError) {
            console.error('Error extrayendo contenido:', extractError)
            // Abortar completamente el proceso si no se puede extraer contenido
            throw new Error(`No se pudo procesar el archivo ${file.name}: ${extractError.message}`)
          }
          
          console.log('🔍 googleFileId después del try-catch de extracción:', googleFileId)
          
          // Verificar si el contenido excede el límite de caracteres (10,240)
          const MAX_CONTENT_LENGTH = 10240
          let contentToStore = content
          
          if (content.length > MAX_CONTENT_LENGTH) {
            console.log(`⚠️ Contenido muy largo (${content.length} caracteres), creando chunks en documentos_entrenador...`)
            
            // Importar embeddings service para chunking
            const embeddingsServiceLib = await import('../../lib/embeddings')
            
            // Dividir contenido en chunks
            const chunks = embeddingsServiceLib.default.splitTextIntoChunks(content, 8000)
            console.log(`✂️ Creando ${chunks.length} chunks en documentos_entrenador`)
            
            // Crear documento principal (truncado)
            contentToStore = content.substring(0, MAX_CONTENT_LENGTH - 200) + 
              `\n\n[DOCUMENTO DIVIDIDO EN CHUNKS: Este documento fue dividido en ${chunks.length} partes para optimizar la búsqueda. Contenido total: ${content.length} caracteres]`
            
            // Metadata del documento principal
            const baseMetadata = {
              name: file.name,
              correo: folder.correo || folder.folder_name,
              source: 'web_upload',
              file_id: googleFileId, // ID del archivo en Google Drive o local
              file_type: file.type,
              file_size: fileSize,
              upload_date: new Date().toISOString(),
              blobType: file.type,
              is_chunked: true,
              original_length: content.length,
              chunks_count: chunks.length,
              chunk_type: 'main'
            }
            
            // Guardar documento principal primero
            const mainFileData = {
              administrador: user.email,
              carpeta_actual: selectedFolder,
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
            
            const { data: mainDoc, error: mainError } = await db.adminDocuments.create(mainFileData)
            if (mainError) {
              console.error('Error guardando documento principal:', mainError)
              throw mainError
            }
            
            console.log('✅ Documento principal guardado, creando chunks...')
            
            // Actualizar progreso después de guardar documento principal
            newUploadProgress[fileId] = 30
            setUploadProgress({ ...newUploadProgress })
            
            // Crear chunks como registros separados
            let successfulChunks = 0
            for (let i = 0; i < chunks.length; i++) {
              try {
                // Generar embedding para el chunk
                const chunkEmbeddingResult = await embeddingsServiceLib.default.generateEmbedding(chunks[i], user.id)
                
                const chunkData = {
                  administrador: user.email,
                  carpeta_actual: selectedFolder,
                  content: chunks[i],
                  name: `${file.name} - Parte ${i + 1}`,
                  file_type: file.type,
                  file_id: googleFileId,
                  file_size: Math.round(fileSize / chunks.length), // Tamaño aproximado del chunk
                  metadata: {
                    ...baseMetadata,
                    chunk_type: 'chunk',
                    chunk_index: i + 1,
                    parent_file_id: googleFileId,
                    chunk_of_total: `${i + 1}/${chunks.length}`,
                    source: 'chunk_from_web_upload',
                    correo: folder.correo || folder.folder_name
                  },
                  embedding: chunkEmbeddingResult.embedding
                }
                
                const { error: chunkError } = await db.adminDocuments.create(chunkData)
                if (chunkError) {
                  console.error(`Error guardando chunk ${i + 1}:`, chunkError)
                } else {
                  successfulChunks++
                  console.log(`✅ Chunk ${i + 1}/${chunks.length} guardado`)
                  
                  // Actualizar progreso basado en chunks procesados
                  // Progreso base del archivo (30%) + progreso de chunks (70%)
                  const baseProgress = 30
                  const chunkProgress = Math.round((successfulChunks / chunks.length) * 70)
                  const totalProgress = Math.min(baseProgress + chunkProgress, 99) // Máximo 99% hasta completar
                  
                  newUploadProgress[fileId] = totalProgress
                  setUploadProgress({ ...newUploadProgress })
                }
                
                // Registrar tokens del chunk
                await embeddingsServiceLib.default.trackTokenUsage(user.id, chunkEmbeddingResult.tokens_used, 'file_embedding')
                
              } catch (chunkError) {
                console.error(`Error procesando chunk ${i + 1}:`, chunkError)
              }
            }
            
            console.log(`✅ ${successfulChunks}/${chunks.length} chunks guardados exitosamente`)
            
            // Actualizar metadata del documento principal
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
              .eq('id', mainDoc.id)
            
            // Continuar con el flujo normal para el documento principal
            // No necesitamos crear otro registro ya que el principal ya se guardó
            
            // Registrar en documentos_usuario_entrenador (flujo de chunks)
            console.log('🔍 googleFileId en flujo de chunks antes de registro:', googleFileId)
            const userTrainerDocData = {
              file_id: googleFileId,
              file_type: file.type,
              file_name: file.name,
              usuario: folder.correo || folder.folder_name,
              entrenador: user.email // Agregar el email del entrenador
            }
            
            console.log('📝 Intentando registrar en documentos_usuario_entrenador:', userTrainerDocData)
            const { data: userTrainerData, error: userTrainerError } = await db.userTrainerDocuments.create(userTrainerDocData)
            if (userTrainerError) {
              console.error('❌ Error registrando en documentos_usuario_entrenador:', userTrainerError)
              console.error('❌ Datos que se intentaron insertar:', userTrainerDocData)
            } else {
              console.log('✅ Registro exitoso en documentos_usuario_entrenador:', userTrainerData)
            }
            
            // Actualizar estadísticas del usuario
            const embeddingSize = embedding.length * 4
            await db.users.update(user.id, {
              used_storage_bytes: (userProfile.used_storage_bytes || 0) + embeddingSize
            })
            
            console.log(`✅ Tokens registrados correctamente: ${tokensUsed} tokens para ${file.name}`)
            
            newUploadProgress[fileId] = 100
            setUploadProgress({ ...newUploadProgress })
            
            // Salir del bucle ya que el archivo se procesó completamente
            continue
          }
          
          // Guardar en la base de datos con estructura JSONB correcta (flujo normal)
          console.log('🔍 googleFileId en flujo normal antes de crear fileData:', googleFileId)
          const fileData = {
            administrador: user.email, // Email del administrador
            carpeta_actual: selectedFolder,
            content: contentToStore, // Contenido limitado o completo según el tamaño
            name: file.name,
            file_type: file.type,
            file_id: googleFileId, // ID del archivo en Google Drive o local
            file_size: fileSize,
            metadata: {
              correo: folder.correo || folder.folder_name, // Email de la carpeta (usuario)
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
          
          // Registrar también en documentos_usuario_entrenador
          console.log('🔍 googleFileId antes de crear userTrainerDocData:', googleFileId)
          const userTrainerDocData = {
            file_id: googleFileId, // ID del archivo en Google Drive
            file_type: file.type,
            file_name: file.name,
            usuario: folder.correo || folder.folder_name, // Email de la carpeta (usuario)
            entrenador: user.email // Email del entrenador que sube el archivo
          }
          
          console.log('📝 Intentando registrar en documentos_usuario_entrenador:', userTrainerDocData)
          console.log('🔍 Verificando file_id en userTrainerDocData:', userTrainerDocData.file_id)
          const { data: userTrainerData, error: userTrainerError } = await db.userTrainerDocuments.create(userTrainerDocData)
          if (userTrainerError) {
            console.error('❌ Error registrando en documentos_usuario_entrenador:', userTrainerError)
            console.error('❌ Datos que se intentaron insertar:', userTrainerDocData)
            // No lanzamos error para no interrumpir el flujo principal
          } else {
            console.log('✅ Registro exitoso en documentos_usuario_entrenador:', userTrainerData)
          }
          
          // Actualizar estadísticas del usuario
          const embeddingSize = embedding.length * 4 // 4 bytes por float
          
          // Actualizar almacenamiento usado
          await db.users.update(user.id, {
            used_storage_bytes: (userProfile.used_storage_bytes || 0) + embeddingSize
          })
          
          // Los tokens ya se registraron correctamente usando embeddingsService.trackTokenUsage
          console.log(`✅ Tokens registrados correctamente: ${tokensUsed} tokens para ${file.name}`)
          
          newUploadProgress[fileId] = 100
          setUploadProgress({ ...newUploadProgress })
          
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error)
          
          // Mostrar mensaje específico según el tipo de error
          if (error.message.includes('No se pudo procesar el archivo') || 
              error.message.includes('Formato de archivo no compatible')) {
            toast.error(`${file.name}: ${error.message}`)
          } else {
            toast.error(`Error subiendo ${file.name}: ${error.message}`)
          }
          
          // Marcar el progreso como fallido
          newUploadProgress[fileId] = -1 // -1 indica error
          setUploadProgress({ ...newUploadProgress })
        }
      }
      
      // Contar archivos exitosos y fallidos
      const successfulFiles = Object.values(newUploadProgress).filter(progress => progress === 100).length
      const failedFiles = Object.values(newUploadProgress).filter(progress => progress === -1).length
      
      if (successfulFiles > 0 && failedFiles === 0) {
        toast.success(`${successfulFiles} archivo(s) subido(s) exitosamente`)
      } else if (successfulFiles > 0 && failedFiles > 0) {
        toast.success(`${successfulFiles} archivo(s) subido(s) exitosamente. ${failedFiles} archivo(s) fallaron.`)
      } else if (failedFiles > 0) {
        toast.error(`Todos los archivos fallaron al subirse`)
      }
      
      // Recargar archivos
      await loadFiles(selectedFolder)
      
      // Limpiar estado
      setSelectedFiles([])
      setShowUploadModal(false)
      setShowDragDropUpload(false)
      setUploadProgress({})
      
      // Mostrar el DragDropUpload nuevamente después de 2 segundos
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
      const fileName = file.metadata?.name || file.metadata?.file_name || ''
      const fileType = file.metadata?.file_type || ''
      
      // Verificar si es un archivo Excel y está registrado en rutinas
      const isExcelFile = fileType?.includes('spreadsheet') || fileType?.includes('excel') || 
                         fileName.toLowerCase().match(/\.(xlsx?|xls)$/)
      
      if (isExcelFile && file.google_file_id) {
        console.log('🔍 Verificando si el archivo Excel está registrado en rutinas...')
        
        // Buscar en la tabla rutinas si este archivo está registrado
        const { data: routineData, error: routineCheckError } = await supabase
          .from('rutinas')
          .select('id, nombre_archivo')
          .eq('file_id', file.google_file_id)
        
        if (routineCheckError) {
          console.error('Error verificando rutinas:', routineCheckError)
        } else if (routineData && routineData.length > 0) {
          console.log('📋 Archivo Excel encontrado en rutinas, eliminando registros...')
          
          // Eliminar de la tabla rutinas
          const { error: routineDeleteError } = await supabase
            .from('rutinas')
            .delete()
            .eq('file_id', file.google_file_id)
          
          if (routineDeleteError) {
            console.error('Error eliminando de rutinas:', routineDeleteError)
            toast.error('Error eliminando las rutinas asociadas al archivo')
          } else {
            console.log('✅ Rutinas eliminadas exitosamente')
          }
        }
      }
      
      // Eliminar de Google Drive si existe
      if (file.google_file_id && userProfile?.google_refresh_token) {
        try {
          await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          await googleDriveService.deleteFile(file.google_file_id)
          console.log('Archivo eliminado de Google Drive:', file.google_file_id)
        } catch (error) {
          console.error('Error deleting from Google Drive:', error)
        }
      }
      
      // Eliminar de documentos_administrador (archivos de admin)
      if (file.metadata?.source === 'documentos_administrador' || file.type === 'admin') {
        const { error: adminDeleteError } = await supabase
          .from('documentos_administrador')
          .delete()
          .eq('id', file.id)
        
        if (adminDeleteError) {
          console.error('Error eliminando de documentos_administrador:', adminDeleteError)
          throw adminDeleteError
        }
        console.log('✅ Archivo eliminado de documentos_administrador')
      }
      
      // Eliminar de documentos_usuario_entrenador (archivos de usuario)
      if (file.metadata?.source === 'documentos_usuario_entrenador' || file.type === 'user') {
        const { error: userTrainerDeleteError } = await supabase
          .from('documentos_usuario_entrenador')
          .delete()
          .eq('id', file.id)
        
        if (userTrainerDeleteError) {
          console.error('Error eliminando de documentos_usuario_entrenador:', userTrainerDeleteError)
          throw userTrainerDeleteError
        }
        console.log('✅ Archivo eliminado de documentos_usuario_entrenador')
      }
      
      // También eliminar todos los chunks relacionados de documentos_entrenador
      if (file.google_file_id) {
        const { error: chunksDeleteError } = await supabase
          .from('documentos_entrenador')
          .delete()
          .eq('metadata->>file_id', file.google_file_id)
        
        if (chunksDeleteError) {
          console.error('Error eliminando chunks de documentos_entrenador:', chunksDeleteError)
          // No lanzamos error para no interrumpir el flujo principal
        } else {
          console.log('✅ Chunks eliminados de documentos_entrenador')
        }
      }
      
      // Las estadísticas de almacenamiento se actualizarán automáticamente
      // ya que se calculan desde documentos_entrenador en el dashboard
      
      // Recargar archivos inmediatamente sin caché
      setFiles([]) // Limpiar estado inmediatamente
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
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Archivos</h1>
                <p className="text-gray-600 mt-1">
                  Sube y organiza tus documentos
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                Subir Archivos
              </button>
              
              {hasExtension('Entrenador') && (
                <button
                  onClick={() => setShowRoutineUpload(true)}
                  className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <DocumentTextIcon className="h-5 w-5 mr-2" />
                  Subir Rutina
                </button>
              )}
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

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

      {/* Drag & Drop Upload */}
      {showDragDropUpload ? (
        <DragDropUpload
          onFilesSelected={handleFileSelect}
          onUpload={handleUpload}
          selectedFolder={selectedFolder}
          folders={folders}
          onFolderChange={setSelectedFolder}
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

      {/* Routine Upload Modal */}
      {showRoutineUpload && (
        <RoutineUpload
          onUploadComplete={() => {
            setShowRoutineUpload(false)
            loadFiles(selectedFolder) // Recargar archivos
          }}
          onClose={() => setShowRoutineUpload(false)}
        />
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
                  {!selectedFolder && <option value="">Seleccionar carpeta</option>}
                  {folders
                    .filter(folder => {
                      // Filtrar carpetas que tienen nombre válido
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
    </div>
  )
}

export default Files