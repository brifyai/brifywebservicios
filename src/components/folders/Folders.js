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
  const [selectedParentFolder, setSelectedParentFolder] = useState(null)
  const [availableSubFolders, setAvailableSubFolders] = useState([])

  const [searchTerm, setSearchTerm] = useState('')
  const [ranEnsureOnce, setRanEnsureOnce] = useState(false)

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
          const adminEmail = adminData[0].administrador
          const result = await supabase
            .from('sub_carpetas_administrador')
            .select('*')
            .eq('administrador_email', adminEmail)
          subFolders = result.data
          error = result.error
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
        .select(`*, extensiones (id, name, name_es, type)`) 
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
        // Si estamos dentro de una carpeta, cargar subcarpetas (carpetas de usuario)
        const { data, error } = await db.userFolders.getByAdministrador(user.email)
        if (error) throw error
        dbFolders = (data || []).map(folder => ({
          ...folder,
          folder_name: folder.correo, // El nombre de la carpeta es el correo
          google_folder_id: folder.id_carpeta_drive,
          type: 'user'
        }))
      } else {
        // Cargar carpeta administrador y carpetas de usuario
        const { data: adminData, error: adminError } = await db.adminFolders.getByUser(user.id)
        if (adminError) throw adminError
        
        const { data: userData, error: userError } = await db.userFolders.getByAdministrador(user.email)
        if (userError) throw userError
        
        // Combinar carpetas admin y de usuario
        const adminFolders = (adminData || []).map(folder => ({
          ...folder,
          folder_name: 'Master - Brify',
          google_folder_id: folder.id_drive_carpeta,
          type: 'admin'
        }))
        
        const userFolders = (userData || []).map(folder => ({
          ...folder,
          folder_name: folder.correo,
          google_folder_id: folder.id_carpeta_drive,
          type: 'user'
        }))
        
        dbFolders = [...adminFolders, ...userFolders]
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
      toast.error('El email del cliente es requerido')
      return
    }
    
    if (!isValidEmail(newFolderName)) {
      toast.error('Debes ingresar un email válido')
      return
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
          
          // Compartir la carpeta con el email especificado
          await googleDriveService.shareFolder(googleFolderId, newFolderName)
          
          toast.success(`Carpeta creada y compartida con ${newFolderName}`)
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
      
      // Guardar en la tabla carpetas_usuario
      const folderData = {
        telegram_id: userProfile?.telegram_id || null,
        correo: newFolderName, // El nombre de la carpeta será el correo
        id_carpeta_drive: googleFolderId,
        administrador: user.email, // Email del administrador que crea la carpeta
        extension: extension // Campo para identificar la extensión
      }
      
      console.log('💾 Datos de carpeta a guardar:', folderData)
      
      const { error } = await db.userFolders.create(folderData)
      
      if (error) {
        console.error('Error saving folder to database:', error)
        toast.error('Error guardando la carpeta')
        return
      }
      
      // Crear usuario automáticamente en la tabla users
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
      
      // Recargar carpetas
      await loadFolders(currentFolder?.id)
      
      // Limpiar formulario
      setNewFolderName('')

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
          selectedFolder: folder,
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Carpetas</h1>
          <p className="text-gray-600 mt-1">
            Organiza y comparte tus carpetas con clientes
          </p>
        </div>
        
        {/* Solo mostrar botón de Nueva Carpeta en el nivel principal */}
        {(!currentFolder || currentFolder.type !== 'user') && (
          <button
            onClick={() => {
                  loadAvailableSubFolders()
                  setShowCreateModal(true)
                }}
            className="mt-4 sm:mt-0 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Nueva Carpeta
          </button>
        )}
      </div>

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
          <h3 className="text-sm font-medium text-gray-900 mb-3">Subcarpetas disponibles</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {availableSubFolders.map((subfolder) => (
              <div
                key={subfolder.id}
                className="flex items-center p-2 bg-white rounded border border-gray-200 hover:border-primary-300 transition-colors"
              >
                <FolderIcon className="h-4 w-4 text-primary-600 mr-2" />
                <span className="text-sm text-gray-700 truncate">
                  {subfolder.nombre_subcarpeta}
                </span>
              </div>
            ))}
          </div>
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
                    <div className="flex items-center mt-1">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        folder.synced ? 'bg-green-400' : 'bg-yellow-400'
                      }`} />
                      <span className="text-xs text-gray-500">
                        {folder.synced ? 'Sincronizado' : 'Solo local'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDeleteFolder(folder)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Eliminar carpeta"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
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
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewFolderName('')
          
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creating || !newFolderName.trim() || !isValidEmail(newFolderName)}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creando...' : 'Crear Carpeta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Folders