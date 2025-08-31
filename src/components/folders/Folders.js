import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db, supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import emailService from '../../lib/emailService'
import {
  FolderIcon,
  FolderOpenIcon,
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
  const [folders, setFolders] = useState([])
  const [currentFolder, setCurrentFolder] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([{ name: 'Inicio', id: null }])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (hasActivePlan()) {
      loadAdminFolderByDefault()
    }
  }, [hasActivePlan])

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
          folder_name: 'Entrenador - Brify',
          google_folder_id: adminFolder.id_drive_carpeta,
          type: 'admin'
        })
        setBreadcrumb([
          { name: 'Inicio', id: null },
          { name: 'Entrenador - Brify', id: adminFolder.id }
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
          folder_name: 'Entrenador - Brify',
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
          
          // Crear carpeta en Google Drive dentro de la carpeta administrador
          const driveFolder = await googleDriveService.createFolder(
            newFolderName,
            adminFolderData.id_drive_carpeta // Usar la carpeta administrador como parent
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
      
      // Guardar en la tabla carpetas_usuario
      const folderData = {
        telegram_id: userProfile?.telegram_id || null,
        correo: newFolderName, // El nombre de la carpeta será el correo
        id_carpeta_drive: googleFolderId,
        administrador: user.email // Email del administrador que crea la carpeta
      }
      
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
              const result = await emailService.sendWelcomeEmail(newFolderName, nameFromEmail)
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
            const result = await emailService.sendWelcomeEmail(newFolderName, nameFromEmail)
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
    // Solo permitir navegación a carpetas de usuario (subcarpetas)
    if (folder.type === 'user') {
      setCurrentFolder(folder)
      setBreadcrumb([...breadcrumb, { name: folder.folder_name, id: folder.google_folder_id }])
      
      // Al navegar a una subcarpeta de usuario, mostrar una vista vacía o archivos
      // ya que las carpetas de usuario no tienen subcarpetas
      setFolders([])
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
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="mt-4 sm:mt-0 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nueva Carpeta
        </button>
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

      {/* Search */}
      <div className="relative">
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
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Crear Primera Carpeta
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFolders.map((folder) => (
            <div
              key={folder.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-6"
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
              </div>
              
              <button
                onClick={() => handleFolderClick(folder)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <FolderOpenIcon className="h-4 w-4 mr-2" />
                Abrir Carpeta
              </button>
            </div>
          ))}
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