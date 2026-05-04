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
  CalendarIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const Folders = () => {
  const { user, userProfile, hasActivePlan } = useAuth()
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
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareTargetFolder, setShareTargetFolder] = useState(null)
  const [shareEmails, setShareEmails] = useState('')
  const [isSharing, setIsSharing] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubFolder, setSelectedSubFolder] = useState(null) // Para filtrar por subcarpeta
  const [ranEnsureOnce, setRanEnsureOnce] = useState(false)

  // Efecto para asegurar scroll al top en móvil al cargar la página
  useEffect(() => {
    // Forzar scroll al inicio en versión móvil
    if (window.innerWidth < 768) {
      window.scrollTo(0, 0)
    }
  }, [])

  useEffect(() => {
    if (hasActivePlan) {
      loadAdminFolderByDefault()
      loadAvailableSubFolders()
    }
  }, [hasActivePlan])

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
      
      // Ordenar subcarpetas según un orden específico
      const orderPriority = {
        'brify': 1,
        'abogados': 2,
        'entrenador': 3,
        'veterinarios': 4
      }
      
      availableSubFolders.sort((a, b) => {
        const priorityA = orderPriority[a.tipo_extension] || 999
        const priorityB = orderPriority[b.tipo_extension] || 999
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB
        }
        
        // Si tienen la misma prioridad, ordenar alfabéticamente
        return a.nombre_subcarpeta.localeCompare(b.nombre_subcarpeta)
      })
      
      console.log('✅ Subcarpetas disponibles finales (ordenadas):', availableSubFolders)
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
      const tokensResult = await googleDriveService.setTokens({
        access_token: credentials.google_access_token,
        refresh_token: credentials.google_refresh_token
      })
      if (!tokensResult) {
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

      // Listar hijos actuales del master en Drive para evitar duplicados por nombre
      let driveChildren = []
      try {
        driveChildren = await googleDriveService.listFiles(masterFolderId, 100)
      } catch (e) {
        console.warn('⚠️ No se pudo listar hijos del master en Drive:', e)
      }

      // Extensiones activas del usuario
      const { data: userExts, error: userExtsError } = await supabase
        .from('plan_extensiones')
        .select(`*, extensiones (id, name, name_es)`) 
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
          // Evitar si ya existe registro en BD por tipo
          if (existingTipos.has(subFolder.tipo)) continue

          // Buscar coincidencia por nombre en Drive
          const existingDriveMatch = Array.isArray(driveChildren)
            ? driveChildren.find(f => f.mimeType === 'application/vnd.google-apps.folder' && (f.name || '').toLowerCase() === subFolder.nombre.toLowerCase())
            : null

          // Solo registrar si ya existe en Drive; no crear desde Folders
          if (existingDriveMatch?.id) {
            const subFolderData = {
              administrador_email: user.email,
              file_id_master: masterFolderId,
              file_id_subcarpeta: existingDriveMatch.id,
              nombre_subcarpeta: subFolder.nombre,
              tipo_extension: subFolder.tipo
            }
            const { error: createError } = await db.subCarpetasAdministrador.create(subFolderData)
            if (createError) {
              console.error(`❌ Error registrando subcarpeta ${subFolder.nombre}:`, createError)
            } else {
              console.log(`✅ Subcarpeta ${subFolder.nombre} registrada en Folders (sin crear en Drive)`)
              existingTipos.add(subFolder.tipo)
            }
          } else {
            console.log(`ℹ️ Subcarpeta ${subFolder.nombre} no existe en Drive; se espera creación por flujo de Plan/Upgrade`)
          }
        } catch (e) {
          console.error(`❌ Error registrando subcarpeta faltante ${subFolder.nombre}:`, e)
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
          synced: true,
          extension: folder.extension // Incluir el campo extension para el filtrado
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
          synced: true,
          extension: folder.extension // Incluir el campo extension para el filtrado
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
          synced: true,
          extension: folder.extension // Incluir el campo extension para el filtrado
        }))
        
        const groupFolders = (groupsData || []).map(folder => ({
          ...folder,
          folder_name: folder.group_name || folder.nombre_grupo_low,
          google_folder_id: folder.folder_id,
          shared_email: 'Grupo compartido',
          type: 'group',
          synced: true,
          extension: folder.extension // Incluir el campo extension para el filtrado
        }))
        
        // Cargar subcarpetas administrador disponibles
        const subFoldersAdmin = availableSubFolders.map(subfolder => ({
          ...subfolder,
          folder_name: subfolder.nombre_subcarpeta,
          google_folder_id: subfolder.id_drive_carpeta,
          shared_email: 'Subcarpeta administrador',
          type: 'sub_carpetas_administrador',
          synced: true,
          parent_folder_id: subfolder.id_drive_carpeta
        }))
        
        dbFolders = [...adminFolders, ...subFoldersAdmin, ...userFolders, ...groupFolders]
      }
      
      // Si el usuario tiene Google Drive conectado, sincronizar con Drive
      if (userProfile?.google_refresh_token) {
        try {
          const tokenResult = await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          
          if (!tokenResult) {
            console.error('Failed to set Google Drive tokens')
            setFolders(dbFolders)
            return
          }
          
          // Obtener carpetas de Google Drive
          const driveFolders = await googleDriveService.listFiles(parentId, 100)
          
          // Combinar información de DB y Drive
          const combinedFolders = dbFolders.map(dbFolder => {
            const driveFolder = (driveFolders && Array.isArray(driveFolders.files)) 
              ? driveFolders.files.find(df => df.id === dbFolder.google_folder_id)
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
          const tokenResult = await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          
          if (!tokenResult) {
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
    // Prevenir eliminación de subcarpetas del administrador
    if (folder.type === 'sub_carpetas_administrador') {
      toast.error('Las carpetas de administrador no se pueden eliminar')
      return
    }

    const folderName = folder.folder_name || folder.name || 'Sin nombre'
    
    // Verificar si la carpeta tiene archivos antes de eliminar
    try {
      const { data: files, error: filesError } = await supabase
        .from('documentos_administrador')
        .select('id, name')
        .eq('carpeta_actual', folder.google_folder_id || folder.id_drive_carpeta)
      
      if (filesError) {
        console.error('Error checking files:', filesError)
      }
      
      let confirmMessage = `¿Estás seguro de que quieres eliminar la carpeta "${folderName}"?`
      
      if (files && files.length > 0) {
        confirmMessage += `\n\nEsta carpeta contiene ${files.length} archivo(s). Al eliminar la carpeta, todos los archivos también serán eliminados permanentemente.`
      }
      
      if (!window.confirm(confirmMessage)) {
        return
      }
    } catch (error) {
      console.error('Error checking files before deletion:', error)
      if (!window.confirm(`¿Estás seguro de que quieres eliminar la carpeta "${folderName}"?`)) {
        return
      }
    }
    
    try {
      // Eliminar archivos de la carpeta si existen
      try {
        const { error: deleteFilesError } = await supabase
          .from('documentos_administrador')
          .delete()
          .eq('carpeta_actual', folder.google_folder_id || folder.id_drive_carpeta)
        
        if (deleteFilesError) {
          console.error('Error deleting files from database:', deleteFilesError)
        }
      } catch (error) {
        console.error('Error in file deletion process:', error)
      }

      // Eliminar de Google Drive si existe
      if (folder.google_folder_id && userProfile?.google_refresh_token) {
        try {
          const tokenResult = await googleDriveService.setTokens({
            refresh_token: userProfile.google_refresh_token
          })
          if (tokenResult) {
            await googleDriveService.deleteFile(folder.google_folder_id)
          }
        } catch (error) {
          console.error('Error deleting from Google Drive:', error)
        }
      }
      
      // Eliminar de la base de datos según el tipo de carpeta
      let deleteError = null
      
      if (currentFolder) {
        // Estamos en carpetas de usuario - eliminar de carpetas_usuario
        const { error } = await supabase
          .from('carpetas_usuario')
          .delete()
          .eq('id', folder.id)
        deleteError = error
      } else {
        // Estamos en carpetas de administrador - eliminar de grupos_drive y grupos_carpetas
        if (folder.type === 'group') {
          // Eliminar de grupos_drive
          const { error } = await supabase
            .from('grupos_drive')
            .delete()
            .eq('id', folder.id)
          deleteError = error
          
          // También eliminar de grupos_carpetas si existe
          if (!deleteError) {
            await supabase
              .from('grupos_carpetas')
              .delete()
              .eq('grupo_id', folder.id)
          }
        } else {
          // Para otros tipos, usar la tabla correspondiente
          const { error } = await supabase
            .from('carpetas_usuario')
            .delete()
            .eq('id', folder.id)
          deleteError = error
        }
      }
      
      if (deleteError) {
        console.error('Error deleting folder from database:', deleteError)
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
    const folderId = folder.google_folder_id || folder.id_drive_carpeta || folder.folder_id
    const folderName = folder.folder_name || folder.name
    
    if (folderId) {
      // Navegar a la pestaña de archivos con la carpeta preseleccionada
      navigate('/files', { 
        state: { 
          selectedFolder: {
            ...folder,
            id: folderId // Usar el ID correcto para el filtrado
          },
          folderId: folderId,
          folderName: folderName
        } 
      })
    } else {
      toast.error('No se puede acceder a esta carpeta: ID no disponible')
    }
  }

  // Abrir modal de compartir carpeta (solo grupos)
  const openShareModal = (folder) => {
    const restrictedNames = ['abogados', 'brify', 'entrenador']
    const name = (folder?.folder_name || folder?.group_name || folder?.name || '').toLowerCase()

    if (folder?.type !== 'group') {
      toast.error('Solo se pueden compartir carpetas de grupo')
      return
    }
    if (restrictedNames.includes(name)) {
      toast.error('Las subcarpetas administrador (Brify/Abogados/Entrenador) no se pueden compartir')
      return
    }
    setShareTargetFolder(folder)
    setShareEmails('')
    setShowShareModal(true)
  }

  // Confirmar compartir: registrar en grupos_carpetas
  const handleConfirmShare = async () => {
    if (!shareTargetFolder || shareTargetFolder.type !== 'group') {
      toast.error('Carpeta inválida para compartir')
      return
    }
    const raw = (shareEmails || '').trim()
    if (!raw) {
      toast.error('Ingresa uno o más correos')
      return
    }
    const emails = raw
      .split(/[;,\s]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalids = emails.filter(e => !emailRegex.test(e))
    if (invalids.length) {
      toast.error(`Correos inválidos: ${invalids.join(', ')}`)
      return
    }

    try {
      setIsSharing(true)
      const carpetaId = shareTargetFolder.google_folder_id || shareTargetFolder.folder_id
      if (!carpetaId) {
        toast.error('ID de carpeta no disponible')
        setIsSharing(false)
        return
      }

      await Promise.all(
        emails.map(async (correo) => {
          const payload = {
            user_id: user.id,
            role: 'lector',
            carpeta_id: carpetaId,
            administrador: user.email,
            usuario_lector: correo
          }
          const { error } = await db.gruposCarpetas.create(payload)
          if (error) throw error
        })
      )

      toast.success(`Carpeta compartida con ${emails.length} usuario(s)`) 
      setShowShareModal(false)
      setShareTargetFolder(null)
      setShareEmails('')
    } catch (error) {
      console.error('Error compartiendo carpeta:', error)
      toast.error('Error registrando el compartido en grupos_carpetas')
    } finally {
      setIsSharing(false)
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

  const filteredFolders = folders
    .filter(folder => {
      // Filtro por término de búsqueda
      const matchesSearch = folder.folder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        folder.shared_email?.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Filtro por subcarpeta seleccionada - LÓGICA CORREGIDA CON CAMPO EXTENSION
      let matchesSubFolder = true
      
      if (selectedSubFolder) {
        // Si hay una subcarpeta seleccionada, solo mostrar:
        // 1. La subcarpeta seleccionada misma
        // 2. Las carpetas que tienen el mismo tipo_extension que la subcarpeta seleccionada
        
        if (folder.type === 'sub_carpetas_administrador') {
          // Solo mostrar la subcarpeta seleccionada
          matchesSubFolder = folder.id === selectedSubFolder.id
        } else if (folder.type === 'user' || folder.type === 'group') {
          // Para carpetas de usuario y grupos, usar el campo 'extension'
          // Comparación insensible a mayúsculas para evitar discrepancias
          const folderExt = (folder.extension || '').toLowerCase()
          const subExt = (selectedSubFolder.tipo_extension || '').toLowerCase()
          matchesSubFolder = folderExt === subExt
        } else {
          // Para otros tipos de carpetas, no mostrar cuando hay filtro activo
          matchesSubFolder = false
        }
      }
      
      // Debug del filtrado - logs más detallados
      if (selectedSubFolder) {
        console.log(`🔍 FILTRADO DEBUG:`)
        console.log(`  - Carpeta: "${folder.folder_name}"`)
        console.log(`  - Tipo: ${folder.type}`)
        console.log(`  - extension: ${folder.extension}`)
        console.log(`  - parent_folder_id: ${folder.parent_folder_id}`)
        console.log(`  - google_folder_id: ${folder.google_folder_id}`)
        console.log(`  - folder.id: ${folder.id}`)
        console.log(`  - selectedSubFolder.id: ${selectedSubFolder.id}`)
        console.log(`  - selectedSubFolder.tipo_extension: ${selectedSubFolder.tipo_extension}`)
        console.log(`  - selectedSubFolder.nombre_subcarpeta: ${selectedSubFolder.nombre_subcarpeta}`)
        console.log(`  - Coincide con filtro: ${matchesSubFolder}`)
        console.log(`  ---`)
      }
      
      return matchesSearch && matchesSubFolder
    })
    .sort((a, b) => {
      // Ordenamiento jerárquico: sub_carpetas_administrador primero
      const aIsAdmin = a.type === 'sub_carpetas_administrador'
      const bIsAdmin = b.type === 'sub_carpetas_administrador'
      
      if (aIsAdmin && !bIsAdmin) return -1
      if (!aIsAdmin && bIsAdmin) return 1
      
      // Si ambos son del mismo tipo, ordenar alfabéticamente
      return a.folder_name.localeCompare(b.folder_name)
    })

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
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Ver Planes
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 scroll-to-top-mobile">
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
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Carpetas</h1>
                <p className="text-gray-600 mt-1">
                  Organiza y comparte tus carpetas con clientes
                </p>
              </div>
            </div>
            
            {/* Solo mostrar botón de Nueva Carpeta en el nivel principal */}
            {(!currentFolder || currentFolder.type !== 'user') && (
              <button
                onClick={() => {
                      loadAvailableSubFolders()
                      setShowCreateModal(true)
                    }}
                className="bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Nueva Carpeta
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
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
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Subcarpetas disponibles</h3>
            {selectedSubFolder && (
              <button
                onClick={() => setSelectedSubFolder(null)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Mostrar todas
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {availableSubFolders.map((subfolder) => (
              <button
                key={subfolder.id}
                onClick={() => setSelectedSubFolder(selectedSubFolder?.id === subfolder.id ? null : subfolder)}
                className={`flex items-center p-2 rounded border transition-colors text-left ${
                  selectedSubFolder?.id === subfolder.id
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'bg-white border-gray-200 hover:border-primary-300 text-gray-700'
                }`}
              >
                <FolderIcon className={`h-4 w-4 mr-2 ${
                  selectedSubFolder?.id === subfolder.id ? 'text-primary-600' : 'text-primary-600'
                }`} />
                <span className="text-sm truncate">
                  {subfolder.nombre_subcarpeta}
                </span>
              </button>
            ))}
          </div>
          {selectedSubFolder && (
            <div className="mt-3 p-2 bg-primary-50 rounded border border-primary-200">
              <p className="text-xs text-primary-700">
                Mostrando carpetas de: <strong>{selectedSubFolder.nombre_subcarpeta}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar carpetas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>



      {/* Folders Grid */}
      {loading ? (
        <LoadingSpinner text="Cargando carpetas..." />
      ) : filteredFolders.length === 0 ? (
        <div className="text-center py-12">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No se encontraron carpetas' : 'No hay carpetas'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda'
              : 'Crea tu primera carpeta para comenzar'
            }
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                loadAvailableSubFolders()
                setShowCreateModal(true)
              }}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Crear Primera Carpeta
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFolders.map((folder) => {
            
            return (
            <div
              key={folder.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all p-6 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <FolderIcon className="h-8 w-8 text-primary-600 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900 truncate">
                      {folder.folder_name}
                    </h3>
                    {/* Temporalmente oculto el estado de sincronización
                    <div className="flex items-center mt-1">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        folder.synced ? 'bg-green-400' : 'bg-gray-400'
                      }`} />
                      <span className="text-xs text-gray-500">
                        {folder.synced ? 'Sincronizado' : 'Pendiente'}
                      </span>
                    </div>
                    */}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {folder.type !== 'sub_carpetas_administrador' && (
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Eliminar carpeta"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                  {folder.type === 'sub_carpetas_administrador' && (
                    <div 
                      className="text-gray-400 p-1 cursor-not-allowed"
                      title="Las carpetas de administrador no se pueden eliminar"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex items-center">
                  <UserIcon className="h-4 w-4 mr-2" />
                  <span className="truncate">{folder.shared_email}</span>
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span>Creada: {formatDate(folder.created_at)}</span>
                </div>
                {folder.extension && (
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      folder.extension === 'Abogados' ? 'bg-blue-500' :
                      folder.extension === 'Entrenador' ? 'bg-green-500' :
                      'bg-purple-500'
                    }`} />
                    <span className="text-xs font-medium">
                      Extensión: {folder.extension}
                    </span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => handleFolderClick(folder)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <DocumentIcon className="h-4 w-4 mr-2" />
                Ver archivos
              </button>

              {(() => {
                const restricted = ['abogados', 'brify', 'entrenador']
                const name = (folder.folder_name || folder.group_name || folder.name || '').toLowerCase()
                const canShare = folder.type === 'group' && !restricted.includes(name)
                return canShare
              })() && (
                <button
                  onClick={() => openShareModal(folder)}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 px-4 rounded-lg transition-colors flex items-center justify-center mt-2"
                  title="Compartir carpeta"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Compartir carpeta
                </button>
              )}

            </div>
            )
          })}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Crear Nueva Carpeta
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                <p className="text-xs text-gray-500 mt-1">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nombre de la carpeta *
                        </label>
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Nombre del grupo o proyecto"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Nombre que tendrá la carpeta del grupo
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email para compartir (opcional)
                        </label>
                        <input
                          type="email"
                          value={newFolderEmail}
                          onChange={(e) => setNewFolderEmail(e.target.value)}
                          placeholder="usuario@ejemplo.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Si proporcionas un email, la carpeta se compartirá automáticamente
                        </p>
                      </div>
                    </>
                  )}

                  {/* Para Entrenador: Selector de tipo + campos correspondientes */}
                  {selectedParentFolder.tipo_extension === 'entrenador' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tipo de carpeta
                        </label>
                        <select
                          value={folderType}
                          onChange={(e) => setFolderType(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="Alumno">Alumno</option>
                          <option value="Normal">Normal</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Alumno: registro individual | Normal: registro de grupo
                        </p>
                      </div>

                      {folderType === 'Alumno' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email del alumno *
                          </label>
                          <input
                            type="email"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="alumno@ejemplo.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            El email será usado como nombre de carpeta y se compartirá automáticamente
                          </p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nombre del grupo *
                            </label>
                            <input
                              type="text"
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              placeholder="Nombre del grupo de entrenamiento"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Nombre que tendrá la carpeta del grupo
                            </p>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Email para compartir (opcional)
                            </label>
                            <input
                              type="email"
                              value={newFolderEmail}
                              onChange={(e) => setNewFolderEmail(e.target.value)}
                              placeholder="entrenador@ejemplo.com"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email del cliente
                  </label>
                  <input
                    type="email"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El email será usado como nombre de carpeta y se compartirá automáticamente
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewFolderName('')
                  setNewFolderEmail('')
                  setFolderType('Alumno')
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creating || !newFolderName.trim() || (selectedParentFolder && selectedParentFolder.tipo_extension === 'entrenador' && folderType === 'Alumno' && !isValidEmail(newFolderName)) || (!selectedParentFolder && !isValidEmail(newFolderName))}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creando...' : 'Crear Carpeta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Folder Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Compartir carpeta
            </h3>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <div className="font-medium text-gray-800">Carpeta</div>
                <div>{shareTargetFolder?.folder_name || shareTargetFolder?.group_name || '—'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correos de usuarios (separados por coma)
                </label>
                <input
                  type="text"
                  value={shareEmails}
                  onChange={(e) => setShareEmails(e.target.value)}
                  placeholder="usuario1@correo.com, usuario2@correo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nota: No disponible para carpetas de usuario (carpetas_usuario) ni subcarpetas administrador.
                </p>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => { setShowShareModal(false); setShareTargetFolder(null); setShareEmails('') }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={isSharing}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmShare}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSharing}
                >
                  {isSharing ? 'Compartiendo…' : 'Compartir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default Folders
