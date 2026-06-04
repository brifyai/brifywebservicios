import { supabase } from '../lib/supabase'
import googleDriveService from '../lib/googleDrive'
import fileContentExtractor from './fileContentExtractor'
import embeddingService from './embeddingService'
import embeddingsServiceLib from '../lib/embeddings'

class SyncService {
  constructor(userEmail = null) {
    this.userEmail = userEmail
    this.userId = null
    this.isInitialized = false
    this.rootFolderId = null
    this.subFolders = []
  }

  /**
   * Inicializar el servicio con el email del usuario
   */
  async initialize(userEmail = null) {
    // Si se pasa un userEmail, usarlo; si no, usar el del constructor
    if (userEmail) {
      this.userEmail = userEmail
    }
    
    // Validar que tenemos un userEmail
    if (!this.userEmail) {
      throw new Error('Email del usuario es requerido para inicializar el servicio de sincronización')
    }
    
    try {
      // Obtener el usuario actual
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('Usuario no autenticado')
      }

      // Almacenar el ID del usuario para uso posterior
      this.userId = user.id

      // Obtener las credenciales de Google Drive del usuario
      const { data: credentials, error: credError } = await supabase
        .from('user_credentials')
        .select('google_access_token, google_refresh_token')
        .eq('user_id', user.id)
        .single()

      if (credError || !credentials) {
        throw new Error('No se encontraron credenciales de Google Drive. Por favor, conecta tu cuenta de Google Drive primero.')
      }

      if (!credentials.google_refresh_token && !credentials.google_access_token) {
        throw new Error('Las credenciales de Google Drive están incompletas. Por favor, reconecta tu cuenta de Google Drive.')
      }

      // Configurar los tokens en el servicio de Google Drive
      const tokensSet = await googleDriveService.setTokens({
        access_token: credentials.google_access_token,
        refresh_token: credentials.google_refresh_token
      })

      if (!tokensSet) {
        throw new Error('Error al configurar las credenciales de Google Drive. Por favor, reconecta tu cuenta.')
      }

      // Obtener el ID de la carpeta raíz desde carpeta_administrador
      await this.loadRootFolder()
      
      // Obtener las subcarpetas de extensiones
      await this.loadSubFolders()

      this.isInitialized = true
      return true
    } catch (error) {
      console.error('Error inicializando SyncService:', error)
      this.isInitialized = false
      throw error
    }
  }

  /**
   * Cargar el ID de la carpeta raíz desde la tabla carpeta_administrador
   */
  async loadRootFolder() {
    try {
      console.log('Buscando carpeta raíz para el usuario:', this.userEmail)
      
      if (!this.userEmail) {
        throw new Error('Email del usuario no está definido')
      }

      const { data, error } = await supabase
        .from('carpeta_administrador')
        .select('id_drive_carpeta')
        .eq('correo', this.userEmail)
        .single()

      if (error) {
        console.error('Error en consulta carpeta_administrador:', error)
        throw new Error(`No se encontró la carpeta raíz del administrador para ${this.userEmail}. Asegúrate de tener un plan activo.`)
      }

      if (!data || !data.id_drive_carpeta) {
        throw new Error(`No se encontró el ID de carpeta para el usuario ${this.userEmail}`)
      }

      this.rootFolderId = data.id_drive_carpeta
      console.log('Carpeta raíz cargada:', this.rootFolderId)
    } catch (error) {
      console.error('Error cargando carpeta raíz:', error)
      throw error
    }
  }

  /**
   * Cargar las subcarpetas de extensiones desde sub_carpetas_administrador
   */
  async loadSubFolders() {
    try {
      const { data, error } = await supabase
        .from('sub_carpetas_administrador')
        .select('*')
        .eq('administrador_email', this.userEmail) // Usar 'administrador_email' para esta tabla específica

      if (error) {
        console.error('Error cargando subcarpetas:', error)
        throw new Error('Error cargando subcarpetas de extensiones')
      }

      this.subFolders = data || []
      console.log('Subcarpetas cargadas:', this.subFolders)
      
      // Agregar log para verificar si se encontraron subcarpetas
      if (this.subFolders.length === 0) {
        console.warn('⚠️ No se encontraron subcarpetas para el usuario:', this.userEmail)
        console.log('💡 Esto puede explicar por qué no se detectan carpetas correctamente')
      } else {
        console.log(`✅ Se cargaron ${this.subFolders.length} subcarpetas:`)
        this.subFolders.forEach(folder => {
          console.log(`  - ${folder.nombre_subcarpeta} (${folder.tipo_extension}): ${folder.file_id_subcarpeta}`)
        })
      }
    } catch (error) {
      console.error('Error cargando subcarpetas:', error)
      throw error
    }
  }

  /**
   * Obtener todos los archivos del usuario desde Google Drive
   * Ahora busca en la carpeta raíz y todas las subcarpetas de extensiones
   */
  async getDriveFiles() {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncService no está inicializado. Llama a initialize() primero.')
      }

      if (!googleDriveService.accessToken) {
        throw new Error('Google Drive no está inicializado')
      }

      if (!this.rootFolderId) {
        throw new Error('No se ha cargado la carpeta raíz')
      }

      const allFiles = []
      const processedFileIds = new Set() // Para evitar duplicados

      // Obtener archivos de la carpeta raíz (sin recursión para evitar duplicados)
      const rootFiles = await this.getFilesFromFolder(this.rootFolderId, false)
      for (const file of rootFiles) {
        if (!processedFileIds.has(file.id)) {
          processedFileIds.add(file.id)
          allFiles.push(file)
        }
      }

      // Obtener archivos de cada subcarpeta de extensión específicamente
      for (const subFolder of this.subFolders) {
        try {
          const subFolderFiles = await this.getFilesFromFolder(subFolder.file_id_subcarpeta, true)
          // Agregar información de la extensión a cada archivo
          for (const file of subFolderFiles) {
            if (!processedFileIds.has(file.id)) {
              processedFileIds.add(file.id)
              const fileWithExtension = {
                ...file,
                extension: subFolder.tipo_extension,
                subFolderId: subFolder.file_id_subcarpeta,
                subFolderName: subFolder.nombre_subcarpeta
              }
              allFiles.push(fileWithExtension)
            }
          }
        } catch (error) {
          console.warn(`Error obteniendo archivos de subcarpeta ${subFolder.nombre_subcarpeta}:`, error)
        }
      }

      return allFiles
    } catch (error) {
      console.error('Error obteniendo archivos de Google Drive:', error)
      throw error
    }
  }

  /**
   * Obtener archivos de una carpeta específica de forma recursiva
   */
  async getFilesFromFolder(folderId, recursive = true) {
    try {
      const files = await googleDriveService.listFiles(folderId, 1000)
      
      // Verificar que files sea un array
      if (!Array.isArray(files)) {
        console.warn('listFiles no devolvió un array:', files)
        return []
      }
      
      const fileDetails = []
      const subFolders = []
      
      // Separar archivos y carpetas
      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Es una carpeta, la guardamos para procesarla recursivamente
          subFolders.push(file)
          
          // También agregar la carpeta como un elemento para ser registrado
          fileDetails.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: 0,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            parents: file.parents,
            folderId: folderId,
            isFolder: true
          })
        } else {
          // Es un archivo, obtenemos su información detallada
          try {
            const fileInfo = await googleDriveService.getFileInfo(file.id)
            fileDetails.push({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              size: file.size,
              createdTime: file.createdTime,
              modifiedTime: file.modifiedTime,
              parents: file.parents,
              folderId: folderId,
              isFolder: false
            })
          } catch (fileError) {
            console.warn(`Error obteniendo info del archivo ${file.id}:`, fileError)
            // Usar la información básica del archivo si no se puede obtener más detalles
            fileDetails.push({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              size: file.size || 0,
              createdTime: file.createdTime,
              modifiedTime: file.modifiedTime,
              parents: file.parents,
              folderId: folderId,
              isFolder: false
            })
          }
        }
      }

      // Si recursive es true, procesar también las subcarpetas
      if (recursive && subFolders.length > 0) {
        console.log(`Procesando ${subFolders.length} subcarpetas en ${folderId}`)
        for (const subFolder of subFolders) {
          try {
            const subFolderFiles = await this.getFilesFromFolder(subFolder.id, true)
            fileDetails.push(...subFolderFiles)
          } catch (subFolderError) {
            console.warn(`Error procesando subcarpeta ${subFolder.name}:`, subFolderError)
          }
        }
      }

      return fileDetails
    } catch (error) {
      console.error(`Error obteniendo archivos de la carpeta ${folderId}:`, error)
      return []
    }
  }

  /**
   * Obtener todos los archivos del usuario desde la base de datos
   * Ahora incluye archivos de todas las tablas relevantes según la extensión
   */
  async getDatabaseFiles() {
    try {
      const allDbFiles = []
      const processedFileIds = new Set() // Para evitar duplicados

      // Obtener archivos de documentos_administrador
      const { data: adminDocs, error: adminError } = await supabase
        .from('documentos_administrador')
        .select('*')
        .eq('administrador', this.userEmail)

      if (!adminError && adminDocs) {
        const formattedAdminDocs = adminDocs.map(doc => ({
          ...doc,
          source: 'documentos_administrador',
          file_id: doc.file_id,
          file_name: doc.file_name || doc.name, // Usar file_name si existe, sino name
          file_type: doc.file_type,
          created_at: doc.created_at,
          extension: doc.servicio || 'general' // Usar 'servicio' en lugar de 'extension'
        }))
        
        // Agregar solo archivos únicos
        for (const doc of formattedAdminDocs) {
          if (doc.file_id && !processedFileIds.has(doc.file_id)) {
            processedFileIds.add(doc.file_id)
            allDbFiles.push(doc)
          }
        }
      }

      // Ya no necesitamos documentos_entrenador porque ahora todo está en documentos_administrador
      // con la columna 'servicio' para identificar el tipo

      // Obtener archivos de grupos_drive
      const { data: groupDocs, error: groupError } = await supabase
        .from('grupos_drive')
        .select('*')
        .eq('administrador', this.userEmail) // Usar 'administrador' en lugar de 'userId'

      if (!groupError && groupDocs) {
        const formattedGroupDocs = groupDocs.map(doc => ({
          ...doc,
          source: 'grupos_drive',
          file_id: doc.folder_id, // Usar 'folder_id' en lugar de 'fileId'
          file_name: doc.group_name, // Usar 'group_name' en lugar de 'fileName'
          file_type: 'folder', // Los grupos_drive son carpetas
          created_at: doc.created_at,
          extension: doc.extension || 'general'
        }))
        
        // Agregar solo archivos únicos
        for (const doc of formattedGroupDocs) {
          if (doc.file_id && !processedFileIds.has(doc.file_id)) {
            processedFileIds.add(doc.file_id)
            allDbFiles.push(doc)
          }
        }
      }

      // Obtener carpetas de carpetas_usuario
      const { data: userFolders, error: userFoldersError } = await supabase
        .from('carpetas_usuario')
        .select('*')
        .eq('administrador', this.userEmail)

      if (!userFoldersError && userFolders) {
        const formattedUserFolders = userFolders.map(folder => ({
          ...folder,
          source: 'carpetas_usuario',
          file_id: folder.folder_id,
          file_name: folder.folder_name,
          file_type: 'folder',
          created_at: folder.created_at,
          extension: folder.extension || 'general'
        }))
        
        // Agregar solo carpetas únicas
        for (const folder of formattedUserFolders) {
          if (folder.file_id && !processedFileIds.has(folder.file_id)) {
            processedFileIds.add(folder.file_id)
            allDbFiles.push(folder)
          }
        }
      }

      console.log(`Base de datos: ${allDbFiles.length} archivos encontrados`)
      return allDbFiles
    } catch (error) {
      console.error('Error obteniendo archivos de la base de datos:', error)
      throw error
    }
  }

  /**
   * Detectar discrepancias entre Google Drive y la base de datos
   * Ahora maneja múltiples fuentes de datos y extensiones
   */
  async detectDiscrepancies() {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncService no está inicializado. Llama a initialize() primero.')
      }

      const [driveFiles, dbFiles] = await Promise.all([
        this.getDriveFiles(),
        this.getDatabaseFiles()
      ])

      // Verificar que ambos sean arrays
      const safeDriveFiles = Array.isArray(driveFiles) ? driveFiles : []
      const safeDbFiles = Array.isArray(dbFiles) ? dbFiles : []

      const discrepancies = {
        toAdd: [],      // Archivos en Drive pero no en DB
        toRemove: [],   // Archivos en DB pero no en Drive
        toUpdate: []    // Archivos modificados
      }

      // Crear mapas para búsqueda eficiente
      const dbFileMap = new Map(safeDbFiles.map(file => [file.file_id, file]))
      const driveFileMap = new Map(safeDriveFiles.map(file => [file.id, file]))

      console.log(`🔍 Archivos en Drive: ${safeDriveFiles.length}`)
      console.log(`🔍 Archivos en DB: ${safeDbFiles.length}`)
      console.log(`🔍 Primeros 3 archivos de Drive:`, safeDriveFiles.slice(0, 3).map(f => ({ id: f.id, name: f.name })))
      console.log(`🔍 Primeros 3 archivos de DB:`, safeDbFiles.slice(0, 3).map(f => ({ file_id: f.file_id, file_name: f.file_name })))

      // Encontrar archivos para agregar (en Drive pero no en DB)
      for (const driveFile of safeDriveFiles) {
        if (!dbFileMap.has(driveFile.id)) {
          console.log(`📄 Archivo para agregar: ${driveFile.name} (${driveFile.id})`)
          discrepancies.toAdd.push(driveFile)
        } else {
          // Verificar si el archivo fue modificado
          const dbFile = dbFileMap.get(driveFile.id)
          const driveModified = new Date(driveFile.modifiedTime)
          const dbModified = new Date(dbFile.created_at) // Usar created_at como referencia

          // También verificar diferencias en nombre o tipo
          if (driveModified > dbModified || 
              driveFile.name !== dbFile.file_name || 
              driveFile.mimeType !== dbFile.file_type) {
            discrepancies.toUpdate.push({
              driveFile,
              dbFile
            })
          }
        }
      }

      // Encontrar archivos para remover (en DB pero no en Drive)
      // Con protección para carpetas de administrador
      for (const dbFile of safeDbFiles) {
        if (!driveFileMap.has(dbFile.file_id)) {
          // Verificar que no sea una carpeta protegida de administrador
          if (!this.isProtectedAdminFile(dbFile)) {
            discrepancies.toRemove.push(dbFile)
          } else {
            console.log(`Archivo protegido omitido de eliminación: ${dbFile.file_name}`)
          }
        }
      }

      console.log(`Discrepancias detectadas:`)
      console.log(`- Archivos para agregar: ${discrepancies.toAdd.length}`)
      console.log(`- Archivos para actualizar: ${discrepancies.toUpdate.length}`)
      console.log(`- Archivos para remover: ${discrepancies.toRemove.length}`)

      return discrepancies
    } catch (error) {
      console.error('Error detectando discrepancias:', error)
      throw error
    }
  }

  /**
   * Verificar si un archivo pertenece a carpetas protegidas de administrador
   */
  isProtectedAdminFile(dbFile) {
    try {
      // Proteger archivos que están en la carpeta raíz del administrador
      if (dbFile.file_id === this.rootFolderId) {
        return true
      }

      // Proteger archivos que están en subcarpetas de administrador
      if (this.subFolders && this.subFolders.length > 0) {
        const isInSubFolder = this.subFolders.some(subFolder => 
          dbFile.file_id === subFolder.file_id_subcarpeta ||
          dbFile.parent_folder_id === subFolder.file_id_subcarpeta
        )
        if (isInSubFolder) {
          return true
        }
      }

      // Proteger archivos cuyo parent_folder_id es la carpeta raíz
      if (dbFile.parent_folder_id === this.rootFolderId) {
        return true
      }

      return false
    } catch (error) {
      console.warn('Error verificando archivo protegido:', error)
      // En caso de error, proteger el archivo por seguridad
      return true
    }
  }

  /**
   * Validar si un texto es un correo electrónico
   */
  isValidEmail(text) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(text)
  }

  /**
   * Determinar el servicio/extensión basado en la carpeta padre
   */
  async getServiceFromParentFolder(folderId) {
    try {
      // Buscar en sub_carpetas_administrador para determinar el servicio
      const { data: subCarpetas, error } = await supabase
        .from('sub_carpetas_administrador')
        .select('*')
        .eq('file_id_subcarpeta', folderId)
        
      if (!error && subCarpetas && subCarpetas.length > 0) {
        return subCarpetas[0].extension || 'general'
      }
      
      // Si no se encuentra, usar el método existente
      return this.getExtensionFromFolder(folderId)
    } catch (error) {
      console.warn('Error obteniendo servicio de carpeta padre:', error)
      return 'general'
    }
  }

  /**
   * Verificar si una carpeta está compartida con usuarios
   */
  async isFolderShared(folderId) {
    try {
      const permissions = await googleDriveService.getFolderPermissions(folderId)
      
      // Debug: Mostrar información detallada de los permisos
      console.log(`🔍 Verificando permisos para carpeta ${folderId}:`)
      console.log(`📊 Total de permisos encontrados: ${permissions ? permissions.length : 0}`)
      
      if (permissions && permissions.length > 0) {
        permissions.forEach((permission, index) => {
          console.log(`  Permiso ${index + 1}:`, {
            type: permission.type,
            role: permission.role,
            emailAddress: permission.emailAddress,
            displayName: permission.displayName
          })
        })
      }
      
      // Una carpeta está compartida si tiene permisos para más de solo el propietario
      const isShared = permissions && permissions.length > 1
      console.log(`📁 Carpeta ${folderId} está compartida: ${isShared}`)
      
      // Debug: Agregar información sobre dónde se procesará esta carpeta
      if (isShared) {
        console.log(`🎯 CARPETA COMPARTIDA DETECTADA: ${folderId} - Se debe registrar en grupos_carpetas`)
      }
      
      return isShared
    } catch (error) {
      console.warn(`❌ No se pudo verificar si la carpeta ${folderId} está compartida:`, error)
      return false
    }
  }
  async addFilesToDatabase(files) {
    const results = []
    
    for (const file of files) {
      try {
        const extension = file.extension || this.getExtensionFromFolder(file.folderId)
        
        // Determinar si es una carpeta o un archivo
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
        
        if (isFolder) {
          // Lógica específica para registro de carpetas según el servicio
          const extension = file.extension || await this.getServiceFromParentFolder(file.folderId)
          const isShared = await this.isFolderShared(file.id)
          
          console.log(`Procesando carpeta: ${file.name}, Extensión: ${extension}, Compartida: ${isShared}`)
          console.log(`🔍 Carpeta ${file.name} (${file.id}) - isShared: ${isShared}`)
          
          if (isShared) {
            console.log(`📢 CARPETA COMPARTIDA DETECTADA: ${file.name} (${file.id}) - Debe registrarse en grupos_carpetas`)
          }
          
          // Determinar dónde registrar la carpeta según el servicio y tipo
          if (extension === 'brify' || extension === 'abogados') {
            // Para servicios Brify y Abogados: siempre en grupos_drive
            const groupData = {
              owner_id: this.userId,
              folder_id: file.id,
              administrador: this.userEmail,
              extension: extension,
              group_name: file.name,
              nombre_grupo_low: file.name.toLowerCase()
            }

            const groupResult = await supabase
              .from('grupos_drive')
              .insert(groupData)
              .select()

            if (groupResult.error) throw groupResult.error

            results.push({
              success: true,
              file: file,
              data: groupResult.data[0],
              extension: extension,
              table: 'grupos_drive'
            })

            // Si está compartida, también registrar en grupos_carpetas
            if (isShared) {
              await this.registerSharedFolderUsers(file.id, this.userEmail)
            }
            
          } else if (extension === 'entrenador') {
            // Para servicio Entrenador: depende del nombre de la carpeta
            if (this.isValidEmail(file.name)) {
              // Si el nombre es un correo (alumno): verificar si ya existe en carpetas_usuario
              const { data: existingUserFolder, error: checkError } = await supabase
                .from('carpetas_usuario')
                .select('id')
                .eq('id_carpeta_drive', file.id)
                .single()

              if (checkError && checkError.code !== 'PGRST116') {
                throw checkError
              }

              // Solo insertar si no existe
              if (!existingUserFolder) {
                const userFolderData = {
                  correo: file.name,
                  id_carpeta_drive: file.id,
                  administrador: this.userEmail,
                  extension: extension,
                  nombre_carpeta: file.name
                }

                const userFolderResult = await supabase
                  .from('carpetas_usuario')
                  .insert(userFolderData)
                  .select()

                if (userFolderResult.error) throw userFolderResult.error

                // Registrar automáticamente el usuario en la tabla users
                const userRegistrationResult = await this.registerUserFromFolder(
                  file.name, 
                  this.userEmail, 
                  extension
                )

                if (!userRegistrationResult.success) {
                  console.warn(`⚠️ Error registrando usuario ${file.name} en users:`, userRegistrationResult.error)
                } else {
                  console.log(`✅ Usuario ${file.name} registrado automáticamente en users`)
                }

                results.push({
                  success: true,
                  file: file,
                  data: userFolderResult.data[0],
                  extension: extension,
                  table: 'carpetas_usuario',
                  userRegistered: userRegistrationResult.success
                })

                // Si está compartida, también registrar en grupos_carpetas
                if (isShared) {
                  console.log(`🔗 Carpeta de usuario ${file.name} está compartida, registrando en grupos_carpetas`)
                  await this.registerSharedFolderUsers(file.id, this.userEmail)
                }
              } else {
                // Ya existe, no insertar pero marcar como procesado
                console.log(`📁 Carpeta ya existe en carpetas_usuario: ${file.name} (ID: ${file.id})`)
                results.push({
                  success: true,
                  file: file,
                  data: existingUserFolder,
                  extension: extension,
                  table: 'carpetas_usuario',
                  skipped: 'already_exists'
                })

                // Verificar si está compartida para registrar en grupos_carpetas (incluso si ya existe)
                if (isShared) {
                  console.log(`🔗 Carpeta existente ${file.name} está compartida, registrando en grupos_carpetas`)
                  await this.registerSharedFolderUsers(file.id, this.userEmail)
                }
              }
              
            } else {
              // Si el nombre NO es un correo: registrar en grupos_drive
              const groupData = {
                owner_id: this.userId,
                folder_id: file.id,
                administrador: this.userEmail,
                extension: extension,
                group_name: file.name,
                nombre_grupo_low: file.name.toLowerCase()
              }

              const groupResult = await supabase
                .from('grupos_drive')
                .insert(groupData)
                .select()

              if (groupResult.error) throw groupResult.error

              results.push({
                success: true,
                file: file,
                data: groupResult.data[0],
                extension: extension,
                table: 'grupos_drive'
              })

              // Si está compartida, también registrar en grupos_carpetas
              if (isShared) {
                await this.registerSharedFolderUsers(file.id, this.userEmail)
              }
            }
            
          } else {
            // Para otros servicios: usar la lógica anterior (por compatibilidad)
            let insertedInUserFolders = false
            
            // Verificar si la carpeta padre es una subcarpeta de administrador
            if (file.folderId) {
              const { data: subCarpetas, error: subError } = await supabase
                .from('sub_carpetas_administrador')
                .select('*')
                .eq('file_id_subcarpeta', file.folderId)
                
              if (!subError && subCarpetas && subCarpetas.length > 0) {
                // La carpeta padre es una subcarpeta de administrador, verificar si ya existe en carpetas_usuario
                const { data: existingUserFolder, error: checkError } = await supabase
                  .from('carpetas_usuario')
                  .select('id')
                  .eq('id_carpeta_drive', file.id)
                  .eq('correo', file.name)
                  .single()

                if (checkError && checkError.code !== 'PGRST116') {
                  throw checkError
                }

                // Solo insertar si no existe
                if (!existingUserFolder) {
                  const userFolderData = {
                    correo: file.name,
                    id_carpeta_drive: file.id,
                    administrador: this.userEmail,
                    extension: extension,
                    nombre_carpeta: file.name
                  }

                  const userFolderResult = await supabase
                    .from('carpetas_usuario')
                    .insert(userFolderData)
                    .select()

                  if (userFolderResult.error) throw userFolderResult.error

                  results.push({
                    success: true,
                    file: file,
                    data: userFolderResult.data[0],
                    extension: extension,
                    table: 'carpetas_usuario'
                  })

                  // Si está compartida, también registrar en grupos_carpetas
                  if (isShared) {
                    await this.registerSharedFolderUsers(file.id, this.userEmail)
                  }
                } else {
                  // Ya existe, no insertar pero marcar como procesado
                  results.push({
                    success: true,
                    file: file,
                    data: existingUserFolder,
                    extension: extension,
                    table: 'carpetas_usuario',
                    skipped: 'already_exists'
                  })

                  // Si está compartida, también registrar en grupos_carpetas
                  if (isShared) {
                    await this.registerSharedFolderUsers(file.id, this.userEmail)
                  }
                }
                
                insertedInUserFolders = true
              }
            }
            
            // Si no se insertó en carpetas_usuario, insertar en grupos_drive
            if (!insertedInUserFolders) {
              const groupData = {
                owner_id: this.userId,
                folder_id: file.id,
                administrador: this.userEmail,
                extension: extension,
                group_name: file.name,
                nombre_grupo_low: file.name.toLowerCase()
              }

              const groupResult = await supabase
                .from('grupos_drive')
                .insert(groupData)
                .select()

              if (groupResult.error) throw groupResult.error

              results.push({
                success: true,
                file: file,
                data: groupResult.data[0],
                extension: extension,
                table: 'grupos_drive'
              })

              // Si está compartida, también registrar en grupos_carpetas
              if (isShared) {
                await this.registerSharedFolderUsers(file.id, this.userEmail)
              }
            }
          }
        } else {
          // Para archivos, insertar solo en documentos_administrador
          // Obtener el nombre de la carpeta actual
          let nombreCarpetaActual = null
          try {
            if (file.folderId) {
              const folderInfo = await googleDriveService.getFileInfo(file.folderId)
              nombreCarpetaActual = folderInfo.name
            }
          } catch (error) {
            console.warn(`No se pudo obtener el nombre de la carpeta ${file.folderId}:`, error)
          }

          // Procesar contenido y generar embeddings
          let content = ''
          let embedding = null
          let fileSize = 0
          let tokensUsed = 0

          try {
            // Descargar el archivo desde Google Drive para procesarlo
            console.log(`📥 Descargando archivo ${file.name} para procesamiento...`)
            const fileBlob = await googleDriveService.downloadFile(file.id)
            
            // Crear un objeto File para el procesamiento
            const fileObject = new File([fileBlob], file.name, { type: file.mimeType })
            fileSize = fileBlob.size

            // Verificar si el archivo es soportado para extracción
            if (fileContentExtractor.isSupported(fileObject)) {
              console.log(`🔍 Extrayendo contenido de ${file.name}...`)
              
              // Extraer contenido usando el mismo proceso que Files.js
              const processed = await embeddingService.processFile(fileObject, fileContentExtractor)
              content = processed.content
              embedding = processed.embedding
              
              // Calcular tokens utilizados
              tokensUsed = Math.ceil(content.length / 4)
              
              // Registrar uso de tokens
              await embeddingsServiceLib.trackTokenUsage(this.userId, tokensUsed, 'sync_embedding')
              
              console.log(`✅ Contenido procesado: ${content.length} caracteres, ${tokensUsed} tokens`)
            } else {
              console.warn(`⚠️ Archivo ${file.name} no es compatible para extracción de contenido`)
              content = `Archivo ${file.name} - Tipo: ${file.mimeType} - No compatible para extracción de texto`
              embedding = null
            }
          } catch (processingError) {
            console.error(`Error procesando archivo ${file.name}:`, processingError)
            content = `Error procesando archivo: ${processingError.message}`
            embedding = null
          }

          // Preparar metadata completa
          const metadata = {
            source: 'sync',
            syncedAt: new Date().toISOString(),
            file_id: file.id,
            file_type: file.mimeType,
            file_size: fileSize,
            blobType: file.mimeType,
            is_chunked: false,
            original_length: content.length,
            chunks_count: 1,
            tokens_used: tokensUsed,
            processed_successfully: embedding !== null
          }

          const docData = {
            file_id: file.id, // ✅ Guardamos el file_id directamente en la columna
            name: file.name,
            file_type: file.mimeType,
            file_size: fileSize,
            administrador: this.userEmail,
            servicio: extension,
            carpeta_actual: file.folderId,
            created_at: new Date().toISOString(),
            telegram_id: null,
            embedding: embedding,
            metadata: metadata,
            content: content,
            pendiente: false,
            nombre_limpio: file.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            nombre_carpeta_actual: nombreCarpetaActual
          }

          const insertResult = await supabase
            .from('documentos_administrador')
            .insert(docData)
            .select()

          if (insertResult.error) throw insertResult.error

          // ✨ NUEVA FUNCIONALIDAD: Verificar si es un archivo Excel y registrar rutina
          if (this.isExcelFile(file.name, file.mimeType)) {
            console.log(`📊 Detectado archivo Excel: ${file.name}`)
            
            // Obtener el email del usuario desde la carpeta
            const userEmail = await this.getUserEmailFromFolder(file.folderId)
            
            if (userEmail) {
              console.log(`👤 Usuario encontrado: ${userEmail}`)
              
              // Procesar el archivo Excel para verificar si es una rutina válida
              try {
                const fileBlob = await googleDriveService.downloadFile(file.id)
                const planSemanal = await this.processExcelForRoutine(fileBlob, file.name)
                
                if (planSemanal) {
                  // Registrar la rutina automáticamente
                  const routineRegistered = await this.registerRoutineFromExcel(
                    file.id, 
                    file.name, 
                    planSemanal, 
                    userEmail
                  )
                  
                  if (routineRegistered) {
                    console.log(`🎯 Rutina registrada automáticamente para ${userEmail} desde ${file.name}`)
                  }
                } else {
                  console.log(`📋 Archivo ${file.name} no cumple con los requisitos de rutina`)
                }
              } catch (routineError) {
                console.error(`Error procesando rutina para ${file.name}:`, routineError)
              }
            } else {
              console.log(`⚠️ No se pudo determinar el usuario para el archivo ${file.name}`)
            }
          }

          // Actualizar el almacenamiento usado del usuario si se generó embedding
          if (embedding && embedding.length > 0) {
            const embeddingSize = embedding.length * 4 // 4 bytes por float
            
            // Obtener el usuario actual
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('used_storage_bytes')
              .eq('id', this.userId)
              .single()

            if (!userError && userData) {
              const newStorageUsed = (userData.used_storage_bytes || 0) + embeddingSize
              
              await supabase
                .from('users')
                .update({ used_storage_bytes: newStorageUsed })
                .eq('id', this.userId)
                
              console.log(`📊 Almacenamiento actualizado: +${embeddingSize} bytes`)
            }
          }

          results.push({
            success: true,
            file: file,
            data: insertResult.data[0],
            extension: extension,
            table: 'documentos_administrador',
            content_processed: content.length > 0,
            embedding_generated: embedding !== null,
            tokens_used: tokensUsed
          })
        }
      } catch (error) {
        console.error(`Error agregando archivo ${file.name}:`, error)
        results.push({
          success: false,
          file: file,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Obtener la extensión basada en el ID de la carpeta
   */
  getExtensionFromFolder(folderId) {
    if (folderId === this.rootFolderId) {
      return 'general'
    }
    
    const subFolder = this.subFolders.find(sf => sf.file_id_subcarpeta === folderId)
    return subFolder ? subFolder.tipo_extension : 'general'
  }

  /**
   * Remover archivos de la base de datos
   * Ahora remueve de múltiples tablas según corresponda
   */
  async removeFilesFromDatabase(files) {
    const results = []
    
    for (const file of files) {
      try {
        let deleteResults = []
        
        // Remover de documentos_administrador
        const adminResult = await supabase
          .from('documentos_administrador')
          .delete()
          .eq('file_id', file.file_id)
          .eq('administrador', this.userEmail) // Usar 'administrador' en lugar de 'administrador_email'

        if (adminResult.error) {
          console.warn(`Error removiendo de documentos_administrador:`, adminResult.error)
        } else {
          deleteResults.push({ table: 'documentos_administrador', deleted: adminResult.data })
        }

        // Ya no necesitamos remover de documentos_entrenador porque todo está en documentos_administrador

        // Remover de grupos_drive
        const groupResult = await supabase
          .from('grupos_drive')
          .delete()
          .eq('folder_id', file.file_id)
          .eq('administrador', this.userEmail)

        if (groupResult.error) {
          console.warn(`Error removiendo de grupos_drive:`, groupResult.error)
        } else {
          deleteResults.push({ table: 'grupos_drive', deleted: groupResult.data })
        }

        // Remover de carpetas_usuario y sincronizar eliminación en users
        const userFolderResult = await supabase
          .from('carpetas_usuario')
          .delete()
          .eq('id_carpeta_drive', file.file_id)
          .select('correo')

        if (userFolderResult.error) {
          console.warn(`Error removiendo de carpetas_usuario:`, userFolderResult.error)
        } else if (userFolderResult.data && userFolderResult.data.length > 0) {
          deleteResults.push({ table: 'carpetas_usuario', deleted: userFolderResult.data })
          
          // Para cada carpeta_usuario eliminada, eliminar el usuario correspondiente
          for (const deletedFolder of userFolderResult.data) {
            try {
              const userRemovalResult = await this.removeUserFromFolder(deletedFolder.correo, this.userEmail)
              if (userRemovalResult.success) {
                console.log(`✅ Usuario ${deletedFolder.correo} eliminado de users por eliminación de carpeta`)
              } else {
                console.warn(`⚠️ Error eliminando usuario ${deletedFolder.correo}:`, userRemovalResult.error)
              }
            } catch (userError) {
              console.error(`Error eliminando usuario ${deletedFolder.correo}:`, userError)
            }
          }
        }

        results.push({
          success: true,
          file: file,
          deleteResults: deleteResults
        })
      } catch (error) {
        console.error(`Error removiendo archivo ${file.file_name || file.name}:`, error)
        results.push({
          success: false,
          file: file,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Actualizar archivos modificados en la base de datos
   * Ahora actualiza en múltiples tablas según corresponda
   */
  async updateModifiedFiles(modifiedFiles) {
    const results = []
    
    for (const { driveFile, dbFile } of modifiedFiles) {
      try {
        let updateResults = []
        const extension = driveFile.extension || this.getExtensionFromFolder(driveFile.folderId)
        
        // Actualizar en documentos_administrador
        const adminResult = await supabase
          .from('documentos_administrador')
          .update({
            name: driveFile.name, // Usar 'name' en lugar de 'file_name'
            file_type: driveFile.mimeType,
            updated_at: new Date().toISOString()
          })
          .eq('file_id', driveFile.id)
          .eq('administrador', this.userEmail) // Usar 'administrador' en lugar de 'administrador_email'
          .select()

        if (adminResult.error) {
          console.warn(`Error actualizando documentos_administrador:`, adminResult.error)
        } else if (adminResult.data.length > 0) {
          updateResults.push({ table: 'documentos_administrador', updated: adminResult.data[0] })
        }

        // Ya no necesitamos actualizar documentos_entrenador porque todo está en documentos_administrador

        // Actualizar en grupos_drive
        const groupResult = await supabase
          .from('grupos_drive')
          .update({
            nombre_grupo_low: driveFile.name.toLowerCase()
          })
          .eq('folder_id', driveFile.id)
          .eq('administrador', this.userEmail)
          .select()

        if (groupResult.error) {
          console.warn(`Error actualizando grupos_drive:`, groupResult.error)
        } else if (groupResult.data.length > 0) {
          updateResults.push({ table: 'grupos_drive', updated: groupResult.data[0] })
        }

        results.push({
          success: true,
          driveFile,
          dbFile,
          updateResults: updateResults,
          extension: extension
        })
      } catch (error) {
        console.error(`Error actualizando archivo ${driveFile.name}:`, error)
        results.push({
          success: false,
          driveFile,
          dbFile,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Aplicar sincronización basada en las selecciones del usuario
   * Prioriza traer archivos del Drive sin eliminar datos existentes
   */
  async applySyncActions(actions) {
    const results = {
      added: [],
      removed: [],
      updated: [],
      errors: []
    }

    try {
      // Agregar archivos nuevos (prioridad principal)
      if (actions.addFiles && actions.addFiles.length > 0) {
        console.log(`Agregando ${actions.addFiles.length} archivos nuevos desde Drive...`)
        const addResults = await this.addFilesToDatabase(actions.addFiles)
        results.added = addResults.filter(r => r.success)
        results.errors.push(...addResults.filter(r => !r.success))
      }

      // Actualizar archivos modificados
      if (actions.updateFiles && actions.updateFiles.length > 0) {
        console.log(`Actualizando ${actions.updateFiles.length} archivos modificados...`)
        const updateResults = await this.updateModifiedFiles(actions.updateFiles)
        results.updated = updateResults.filter(r => r.success)
        results.errors.push(...updateResults.filter(r => !r.success))
      }

      // Eliminar archivos que ya no existen en Drive (con protección)
      if (actions.removeFiles && actions.removeFiles.length > 0) {
        console.log(`Eliminando ${actions.removeFiles.length} archivos que ya no existen en Drive...`)
        const removeResults = await this.removeFilesFromDatabase(actions.removeFiles)
        results.removed = removeResults.filter(r => r.success)
        results.errors.push(...removeResults.filter(r => !r.success))
      }

      // Sincronizar usuarios con carpetas_usuario después de procesar archivos
      console.log('Sincronizando usuarios con carpetas_usuario...')
      try {
        const userSyncResult = await this.syncUserFoldersWithUsers()
        if (userSyncResult.success) {
          console.log(`✅ Sincronización de usuarios completada: ${userSyncResult.processed} carpetas procesadas`)
        } else {
          console.warn('⚠️ Error en sincronización de usuarios:', userSyncResult.error)
          results.errors.push({
            success: false,
            error: `Error sincronizando usuarios: ${userSyncResult.error}`
          })
        }
      } catch (userSyncError) {
        console.error('Error en sincronización de usuarios:', userSyncError)
        results.errors.push({
          success: false,
          error: `Error sincronizando usuarios: ${userSyncError.message}`
        })
      }

      // Verificar rutinas existentes en re-sincronizaciones
      console.log('Verificando rutinas existentes en documentos Excel...')
      try {
        const routineCheckResult = await this.checkExistingExcelRoutines()
        if (routineCheckResult.processed > 0) {
          console.log(`✅ Verificación de rutinas completada: ${routineCheckResult.processed} archivos procesados, ${routineCheckResult.registered} rutinas registradas`)
        }
      } catch (routineCheckError) {
        console.error('Error verificando rutinas existentes:', routineCheckError)
        results.errors.push({
          success: false,
          error: `Error verificando rutinas existentes: ${routineCheckError.message}`
        })
      }

      console.log(`Sincronización completada:`)
      console.log(`- Archivos agregados: ${results.added.length}`)
      console.log(`- Archivos actualizados: ${results.updated.length}`)
      console.log(`- Archivos eliminados: ${results.removed.length}`)
      console.log(`- Errores: ${results.errors.length}`)

      return results
    } catch (error) {
      console.error('Error aplicando acciones de sincronización:', error)
      throw error
    }
  }

  /**
   * Obtener estadísticas de sincronización
   */
  async getSyncStats() {
    try {
      if (!this.isInitialized) {
        throw new Error('SyncService no está inicializado. Llama a initialize() primero.')
      }

      const discrepancies = await this.detectDiscrepancies()
      
      return {
        totalDiscrepancies: discrepancies.toAdd.length + discrepancies.toRemove.length + discrepancies.toUpdate.length,
        toAdd: discrepancies.toAdd.length,
        toRemove: discrepancies.toRemove.length,
        toUpdate: discrepancies.toUpdate.length,
        lastSync: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas de sincronización:', error)
      throw error
    }
  }

  // Registrar usuarios con acceso a carpetas compartidas en grupos_carpetas
  async registerSharedFolderUsers(folderId, administradorEmail) {
    try {
      console.log(`🚀 INICIANDO registerSharedFolderUsers para carpeta ${folderId} con administrador ${administradorEmail}`)
      
      // Obtener permisos de la carpeta desde Google Drive
      const permissions = await googleDriveService.getFolderPermissions(folderId)
      
      if (!permissions || permissions.length === 0) {
        console.log(`No se encontraron permisos para la carpeta ${folderId}`)
        return
      }

      // Filtrar solo usuarios compartidos (excluir propietario)
      const sharedUsers = permissions.filter(permission => 
        permission.type === 'user' && 
        permission.role !== 'owner' &&
        permission.emailAddress &&
        permission.emailAddress !== administradorEmail
      )

      if (sharedUsers.length === 0) {
        console.log(`No se encontraron usuarios compartidos para la carpeta ${folderId}`)
        return
      }

      console.log(`📝 Registrando ${sharedUsers.length} usuarios compartidos para carpeta ${folderId}`)

      // Obtener el user_id del administrador
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('id')
        .eq('email', administradorEmail)
        .single()

      if (adminError || !adminUser) {
        console.error('Error obteniendo datos del administrador:', adminError)
        return
      }

      console.log(`👤 Administrador encontrado: ${administradorEmail} (ID: ${adminUser.id})`)

      // Registrar cada usuario con acceso en grupos_carpetas
      for (const permission of sharedUsers) {
        try {
          console.log(`🔍 Procesando usuario compartido: ${permission.emailAddress} (${permission.role})`)
          
          // Verificar si ya existe el registro
          const { data: existingRecord, error: checkError } = await supabase
            .from('grupos_carpetas')
            .select('id')
            .eq('carpeta_id', folderId)
            .eq('usuario_lector', permission.emailAddress)
            .single()

          if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error verificando registro existente:', checkError)
            continue
          }

          if (existingRecord) {
            console.log(`⚠️ Usuario ${permission.emailAddress} ya registrado para carpeta ${folderId}`)
            continue
          }

          // Crear nuevo registro en grupos_carpetas
          const carpetaData = {
            user_id: adminUser.id,
            role: permission.role === 'writer' ? 'editor' : 'lector', // Mapear roles de Google Drive
            carpeta_id: folderId,
            administrador: administradorEmail,
            usuario_lector: permission.emailAddress,
            created_at: new Date().toISOString()
          }

          console.log(`💾 Insertando en grupos_carpetas:`, carpetaData)

          const { error: insertError } = await supabase
            .from('grupos_carpetas')
            .insert(carpetaData)

          if (insertError) {
            console.error(`❌ Error registrando usuario ${permission.emailAddress} en grupos_carpetas:`, insertError)
          } else {
            console.log(`✅ Usuario ${permission.emailAddress} registrado exitosamente en grupos_carpetas para carpeta ${folderId}`)
          }

        } catch (userError) {
          console.error(`Error procesando usuario ${permission.emailAddress}:`, userError)
        }
      }

      // Eliminar usuarios que ya no tienen acceso a la carpeta
      await this.cleanupRemovedSharedUsers(folderId, sharedUsers, administradorEmail)

      console.log(`🏁 COMPLETADO registerSharedFolderUsers para carpeta ${folderId}`)

    } catch (error) {
      console.error('❌ Error registrando usuarios de carpeta compartida:', error)
    }
  }

  // Eliminar usuarios de grupos_carpetas que ya no tienen acceso en Drive
  async cleanupRemovedSharedUsers(folderId, currentPermissions, administradorEmail) {
    try {
      // Obtener todos los usuarios registrados en grupos_carpetas para esta carpeta
      const { data: existingRecords, error: fetchError } = await supabase
        .from('grupos_carpetas')
        .select('id, usuario_lector')
        .eq('carpeta_id', folderId)
        .eq('administrador', administradorEmail)

      if (fetchError) {
        console.error('Error obteniendo registros existentes de grupos_carpetas:', fetchError)
        return
      }

      if (!existingRecords || existingRecords.length === 0) {
        return
      }

      // Crear lista de emails actuales con permisos
      const currentEmails = currentPermissions.map(p => p.emailAddress)

      // Encontrar registros que ya no tienen permisos
      const recordsToRemove = existingRecords.filter(record => 
        !currentEmails.includes(record.usuario_lector)
      )

      // Eliminar registros obsoletos
      for (const record of recordsToRemove) {
        const { error: deleteError } = await supabase
          .from('grupos_carpetas')
          .delete()
          .eq('id', record.id)

        if (deleteError) {
          console.error(`Error eliminando usuario ${record.usuario_lector} de grupos_carpetas:`, deleteError)
        } else {
          console.log(`🗑️ Usuario ${record.usuario_lector} eliminado de grupos_carpetas para carpeta ${folderId}`)
        }
      }

    } catch (error) {
      console.error('Error limpiando usuarios removidos de carpeta compartida:', error)
    }
  }

  /**
   * Registrar usuario automáticamente en la tabla users cuando se crea una carpeta_usuario
   */
  async registerUserFromFolder(email, administradorEmail, extension = 'Entrenador') {
  try {
    console.log(`🔍 Verificando si el usuario ${email} ya existe en users`)
    
    // Verificar si el usuario ya existe
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, cliente, estado_interaccion')
      .eq('email', email)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error verificando usuario existente:', checkError)
      return { success: false, error: checkError }
    }

    if (existingUser) {
      console.log(`✅ Usuario ${email} ya existe en users`)
      
      // Verificar si necesita actualizar campos específicos
      const needsUpdate = !existingUser.cliente || existingUser.estado_interaccion !== 'Entrenador'
      
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            cliente: true,
            estado_interaccion: 'Entrenador'
          })
          .eq('email', email)

        if (updateError) {
          console.error('Error actualizando usuario existente:', updateError)
          return { success: false, error: updateError }
        }
        
        console.log(`✅ Usuario ${email} actualizado con cliente=true y estado_interaccion=Entrenador`)
      }
      
      return { success: true, user: existingUser, updated: needsUpdate }
    }

    // Crear nuevo usuario
    const nameFromEmail = email.split('@')[0]
    
    const userData = {
      email: email,
      name: nameFromEmail,
      cliente: true,
      estado_interaccion: 'Entrenador',
      is_active: true,
      registered_via: 'folder_sync',
      used_storage_bytes: 0,
      admin: false,
      onboarding_status: 'completed'
    }

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single()

    if (createError) {
      console.error('Error creando usuario desde sincronización:', createError)
      return { success: false, error: createError }
    }

    console.log(`✅ Usuario ${email} creado automáticamente desde sincronización`)
    return { success: true, user: newUser, created: true }
  
  } catch (error) {
      console.error('Error en registerUserFromFolder:', error)
      return { success: false, error }
    }
  }

  /**
   * Eliminar usuario de la tabla users cuando se elimina una carpeta_usuario
   */
  async removeUserFromFolder(email, administradorEmail) {
  try {
    console.log(`🔍 Verificando eliminación de usuario ${email} para administrador ${administradorEmail}`)
    
    // Verificar si el usuario existe y fue creado por sincronización de carpetas
    const { data: user, error: checkError } = await supabase
      .from('users')
      .select('id, email, registered_via, cliente, estado_interaccion')
      .eq('email', email)
      .single()

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        console.log(`ℹ️ Usuario ${email} no existe en users`)
        return { success: true, message: 'Usuario no existe' }
      }
      console.error('Error verificando usuario para eliminación:', checkError)
      return { success: false, error: checkError }
    }

    // Verificar si hay otras carpetas_usuario con el mismo email de otros administradores
    const { data: otherFolders, error: foldersError } = await supabase
      .from('carpetas_usuario')
      .select('id, administrador')
      .eq('correo', email)
      .neq('administrador', administradorEmail)

    if (foldersError) {
      console.error('Error verificando otras carpetas del usuario:', foldersError)
      return { success: false, error: foldersError }
    }

    if (otherFolders && otherFolders.length > 0) {
      console.log(`⚠️ Usuario ${email} tiene carpetas con otros administradores, no se eliminará de users`)
      return { success: true, message: 'Usuario tiene otras carpetas, no eliminado' }
    }

    // Solo eliminar si fue creado por sincronización de carpetas y no tiene otras carpetas
    if (user.registered_via === 'folder_sync' || user.registered_via === 'folder_creation') {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', email)

      if (deleteError) {
        console.error('Error eliminando usuario:', deleteError)
        return { success: false, error: deleteError }
      }

      console.log(`✅ Usuario ${email} eliminado de users (creado por sincronización)`)
      return { success: true, deleted: true }
    } else {
      console.log(`ℹ️ Usuario ${email} no fue creado por sincronización, no se elimina`)
      return { success: true, message: 'Usuario no creado por sincronización' }
    }

  } catch (error) {
    console.error('Error en removeUserFromFolder:', error)
    return { success: false, error }
  }
  }

  /**
   * Sincronizar carpetas_usuario con la tabla users
   */
  async syncUserFoldersWithUsers() {
  try {
    console.log('🚀 Iniciando sincronización de carpetas_usuario con users')
    
    // Obtener todas las carpetas_usuario
    const { data: userFolders, error: foldersError } = await supabase
      .from('carpetas_usuario')
      .select('correo, administrador, extension')

    if (foldersError) {
      console.error('Error obteniendo carpetas_usuario:', foldersError)
      return { success: false, error: foldersError }
    }

    if (!userFolders || userFolders.length === 0) {
      console.log('No hay carpetas_usuario para sincronizar')
      return { success: true, processed: 0 }
    }

    let processed = 0
    let created = 0
    let updated = 0
    let errors = 0

    // Procesar cada carpeta_usuario
    for (const folder of userFolders) {
      try {
        const result = await this.registerUserFromFolder(
          folder.correo, 
          folder.administrador, 
          folder.extension || 'Entrenador'
        )
        
        if (result.success) {
          if (result.created) created++
          if (result.updated) updated++
          processed++
        } else {
          errors++
          console.error(`Error procesando carpeta ${folder.correo}:`, result.error)
        }
      } catch (error) {
        errors++
        console.error(`Error procesando carpeta ${folder.correo}:`, error)
      }
    }

    console.log(`✅ Sincronización completada: ${processed} procesadas, ${created} creadas, ${updated} actualizadas, ${errors} errores`)
    
    return {
      success: true,
      stats: {
        processed,
        created,
        updated,
        errors
      }
    }

    } catch (error) {
      console.error('Error en syncUserFoldersWithUsers:', error)
      return { success: false, error }
    }
  }

  /**
   * Verificar si un archivo es un Excel/Sheet/XLSX
   */
  isExcelFile(fileName, mimeType) {
    const excelExtensions = ['.xls', '.xlsx', '.xlsm']
    const excelMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.google-apps.spreadsheet'
    ]
    
    const hasExcelExtension = excelExtensions.some(ext => 
      fileName.toLowerCase().endsWith(ext)
    )
    
    const hasExcelMimeType = excelMimeTypes.includes(mimeType)
    
    return hasExcelExtension || hasExcelMimeType
  }

  /**
   * Procesar archivo Excel para validar si es una rutina válida
   */
  async processExcelForRoutine(fileBlob, fileName) {
    try {
      // Importar XLSX dinámicamente
      const XLSX = await import('xlsx')
      
      // Leer el archivo Excel
      const arrayBuffer = await fileBlob.arrayBuffer()
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
      
      // Verificar que existan las hojas requeridas
      const requiredSheets = ['Rutina de Ejercicios', 'Alimentación']
      const availableSheets = workbook.SheetNames
      
      const missingSheets = requiredSheets.filter(sheet => !availableSheets.includes(sheet))
      if (missingSheets.length > 0) {
        console.log(`⚠️ Archivo ${fileName} no es una rutina válida: faltan hojas ${missingSheets.join(', ')}`)
        return null
      }

      // Leer datos de ambas hojas
      const rutinaSheet = workbook.Sheets['Rutina de Ejercicios']
      const alimentacionSheet = workbook.Sheets['Alimentación']
      
      const rutinaData = XLSX.utils.sheet_to_json(rutinaSheet)
      const alimentacionData = XLSX.utils.sheet_to_json(alimentacionSheet)
      
      // Validar que tengan datos
      if (!rutinaData || rutinaData.length === 0) {
        console.log(`⚠️ Archivo ${fileName} no es una rutina válida: hoja 'Rutina de Ejercicios' vacía`)
        return null
      }

      // Procesar datos usando la misma lógica que RoutineUpload
      const planSemanal = this.processRoutineData(rutinaData, alimentacionData)
      
      console.log(`✅ Archivo ${fileName} es una rutina válida`)
      return planSemanal
      
    } catch (error) {
      console.error(`Error procesando Excel ${fileName} para rutina:`, error)
      return null
    }
  }

  /**
   * Procesar los datos de rutina y alimentación (copiado de RoutineUpload.js)
   */
  processRoutineData(rutinaData, alimentacionData) {
    const planSemanal = {
      "Lunes": { ejercicios: [], alimentacion: {} },
      "Martes": { ejercicios: [], alimentacion: {} },
      "Miércoles": { ejercicios: [], alimentacion: {} },
      "Jueves": { ejercicios: [], alimentacion: {} },
      "Viernes": { ejercicios: [], alimentacion: {} },
      "Sábado": { ejercicios: [], alimentacion: {} },
      "Domingo": { ejercicios: [], alimentacion: {} }
    }

    // Mapeo de días en español
    const dayMapping = {
      'lunes': 'Lunes',
      'martes': 'Martes', 
      'miercoles': 'Miércoles',
      'miércoles': 'Miércoles',
      'jueves': 'Jueves',
      'viernes': 'Viernes',
      'sabado': 'Sábado',
      'sábado': 'Sábado',
      'domingo': 'Domingo'
    }

    // Procesar datos de rutina
    rutinaData.forEach(row => {
      const diaRaw = row['Día']?.toLowerCase()?.trim()
      const dia = dayMapping[diaRaw]
      
      if (dia && planSemanal[dia]) {
        const ejercicio = {
          nombre: row['Ejercicio'] || row['Nombre'] || '',
          series: parseInt(row['Series']) || 0,
          repeticiones: parseInt(row['Repeticiones']) || 0,
          descanso_seg: parseInt(row['Descanso (seg)'] || row['Descanso']) || 0
        }
        
        // Solo agregar si tiene nombre de ejercicio
        if (ejercicio.nombre.trim()) {
          planSemanal[dia].ejercicios.push(ejercicio)
        }
      }
    })

    // Procesar datos de alimentación
    console.log('🔍 Datos de alimentación recibidos:', alimentacionData)
    
    const alimentacionPorDia = {}
    alimentacionData.forEach(row => {
      console.log('📋 Procesando fila de alimentación:', row)
      
      const diaRaw = row['Día']?.toLowerCase()?.trim()
      const dia = dayMapping[diaRaw]
      
      if (dia) {
        if (!alimentacionPorDia[dia]) {
          alimentacionPorDia[dia] = {
            desayuno: '',
            almuerzo: '',
            cena: '',
            snacks_meriendas: ''
          }
        }
        
        // Leer directamente las columnas del Excel según la estructura mostrada
        const desayuno = row['Desayuno'] || ''
        const almuerzo = row['Almuerzo'] || ''
        const cena = row['Cena'] || ''
        const snacks = row['Snacks/Meriendas'] || row['SnacksMeriendas'] || ''
        
        if (desayuno.trim()) {
          alimentacionPorDia[dia].desayuno = desayuno.trim()
        }
        if (almuerzo.trim()) {
          alimentacionPorDia[dia].almuerzo = almuerzo.trim()
        }
        if (cena.trim()) {
          alimentacionPorDia[dia].cena = cena.trim()
        }
        if (snacks.trim()) {
          alimentacionPorDia[dia].snacks_meriendas = snacks.trim()
        }
      }
    })

    console.log('🍽️ Alimentación procesada por día:', alimentacionPorDia)

    // Asignar alimentación procesada al plan semanal
    Object.keys(alimentacionPorDia).forEach(dia => {
      if (planSemanal[dia]) {
        planSemanal[dia].alimentacion = alimentacionPorDia[dia]
      }
    })

    // Agregar ejercicio vacío al final de cada día (como en el ejemplo)
    Object.keys(planSemanal).forEach(dia => {
      planSemanal[dia].ejercicios.push({})
    })

    return planSemanal
  }

  /**
   * Registrar rutina automáticamente en la tabla rutinas
   */
  async registerRoutineFromExcel(fileId, fileName, planSemanal, userEmail) {
    try {
      console.log(`📋 Registrando rutina automáticamente para usuario: ${userEmail}`)
      
      // Verificar si ya existe una rutina para este usuario
      const { data: existingRoutine, error: checkError } = await supabase
        .from('rutinas')
        .select('*')
        .eq('user_email', userEmail)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error verificando rutina existente:', checkError)
        return false
      }

      let routineResult
      if (existingRoutine) {
        // Actualizar rutina existente
        console.log(`🔄 Actualizando rutina existente para ${userEmail}`)
        routineResult = await supabase
          .from('rutinas')
          .update({
            plan_semanal: planSemanal,
            updated_at: new Date().toISOString(),
            administrador: this.userEmail,
            file_id: fileId
          })
          .eq('user_email', userEmail)
      } else {
        // Crear nueva rutina
        console.log(`➕ Creando nueva rutina para ${userEmail}`)
        routineResult = await supabase
          .from('rutinas')
          .insert({
            user_email: userEmail,
            plan_semanal: planSemanal,
            administrador: this.userEmail,
            file_id: fileId
          })
      }
      
      if (routineResult.error) {
        console.error('Error registrando rutina:', routineResult.error)
        return false
      }

      console.log(`✅ Rutina registrada exitosamente para ${userEmail}`)
      return true
      
    } catch (error) {
      console.error('Error en registerRoutineFromExcel:', error)
      return false
    }
  }

  /**
   * Obtener el email del usuario desde la carpeta padre
   */
  async getUserEmailFromFolder(folderId) {
    try {
      // Buscar en carpetas_usuario
      const { data: carpetaUsuario, error: carpetaError } = await supabase
        .from('carpetas_usuario')
        .select('correo')
        .eq('id_carpeta_drive', folderId)
        .single()

      if (!carpetaError && carpetaUsuario) {
        return carpetaUsuario.correo
      }

      // Si no se encuentra directamente, buscar en carpetas padre
      try {
        const folderInfo = await googleDriveService.getFileInfo(folderId)
        if (folderInfo && folderInfo.parents && folderInfo.parents.length > 0) {
          return await this.getUserEmailFromFolder(folderInfo.parents[0])
        }
      } catch (driveError) {
        console.warn(`No se pudo obtener info de carpeta ${folderId}:`, driveError)
      }

      return null
    } catch (error) {
      console.error('Error obteniendo email de usuario desde carpeta:', error)
      return null
    }
  }

  /**
   * Verificar rutinas existentes en documentos Excel durante re-sincronizaciones
   */
  async checkExistingExcelRoutines() {
    try {
      console.log('🔍 Buscando archivos Excel existentes en documentos_administrador...')
      
      // Obtener todos los archivos Excel de documentos_administrador que no están en rutinas
      const { data: excelFiles, error } = await supabase
        .from('documentos_administrador')
        .select('id, metadata')
        .or('metadata->>file_type.eq.application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,metadata->>file_type.eq.application/vnd.ms-excel')
        .eq('metadata->>administrador', this.userEmail)
      
      if (error) {
        throw new Error(`Error consultando archivos Excel: ${error.message}`)
      }
      
      if (!excelFiles || excelFiles.length === 0) {
        console.log('📄 No se encontraron archivos Excel existentes')
        return { processed: 0, registered: 0 }
      }
      
      console.log(`📊 Encontrados ${excelFiles.length} archivos Excel para verificar`)
      
      let processed = 0
      let registered = 0
      
      for (const file of excelFiles) {
        try {
          const metadata = file.metadata
          const fileId = metadata.file_id
          const fileName = metadata.file_name
          
          // Verificar si ya existe una rutina para este archivo
          const { data: existingRoutine } = await supabase
            .from('rutinas')
            .select('id')
            .eq('file_id', fileId)
            .single()
          
          if (existingRoutine) {
            console.log(`⏭️ Rutina ya existe para ${fileName}, omitiendo`)
            continue
          }
          
          // Verificar si es un archivo Excel válido
          if (!this.isExcelFile(fileName, metadata.file_type)) {
            continue
          }
          
          // Obtener el email del usuario desde la carpeta padre
          const userEmail = await this.getUserEmailFromFolder(metadata.folder_id)
          if (!userEmail) {
            console.warn(`⚠️ No se pudo determinar el usuario para ${fileName}`)
            continue
          }
          
          console.log(`📥 Procesando archivo Excel existente: ${fileName} para usuario: ${userEmail}`)
          
          // Descargar y procesar el archivo
          const fileBlob = await googleDriveService.downloadFile(fileId)
          const routineData = await this.processExcelForRoutine(fileBlob, fileName)
          
          if (routineData) {
            const planSemanal = this.processRoutineData(routineData.rutina, routineData.alimentacion)
            await this.registerRoutineFromExcel(fileId, fileName, planSemanal, userEmail)
            registered++
            console.log(`✅ Rutina registrada para archivo existente: ${fileName}`)
          }
          
          processed++
        } catch (fileError) {
          console.error(`❌ Error procesando archivo Excel existente ${file.metadata?.file_name}:`, fileError)
        }
      }
      
      return { processed, registered }
    } catch (error) {
      console.error('Error verificando rutinas existentes:', error)
      throw error
    }
  }
}

// Instancia singleton
const syncService = new SyncService()

export default syncService
export { SyncService }
