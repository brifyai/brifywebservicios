/**
 * Script para procesar archivos Excel existentes en documentos_administrador
 * y registrarlos automáticamente como rutinas si cumplen los requisitos
 */

import dotenv from 'dotenv'
import { supabase } from './src/lib/supabase.js'
import googleDriveService from './src/lib/googleDrive.js'
import XLSX from 'xlsx'

// Cargar variables de entorno
dotenv.config()

class ExistingExcelProcessor {
  constructor() {
    this.processedCount = 0
    this.routinesRegistered = 0
    this.errors = []
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
      // Leer el archivo Excel
      const arrayBuffer = await fileBlob.arrayBuffer()
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
      
      // Verificar que existan las hojas requeridas
      const requiredSheets = ['Rutina de Ejercicios', 'Alimentación']
      const availableSheets = workbook.SheetNames
      
      console.log(`📋 Hojas disponibles en ${fileName}:`, availableSheets)
      
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
      
      console.log(`📊 Datos de rutina encontrados: ${rutinaData.length} filas`)
      console.log(`🍽️ Datos de alimentación encontrados: ${alimentacionData.length} filas`)
      
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
   * Procesar los datos de rutina y alimentación
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
    alimentacionData.forEach(row => {
      const diaRaw = row['Día']?.toLowerCase()?.trim()
      const dia = dayMapping[diaRaw]
      
      if (dia && planSemanal[dia]) {
        const comida = row['Comida']?.toLowerCase()?.trim()
        
        if (comida) {
          const alimentoData = {
            alimento: row['Alimento'] || '',
            cantidad: row['Cantidad'] || '',
            calorias: parseInt(row['Calorías'] || row['Calorias']) || 0
          }
          
          if (!planSemanal[dia].alimentacion[comida]) {
            planSemanal[dia].alimentacion[comida] = []
          }
          
          if (alimentoData.alimento.trim()) {
            planSemanal[dia].alimentacion[comida].push(alimentoData)
          }
        }
      }
    })

    return planSemanal
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
   * Registrar rutina automáticamente en la tabla rutinas
   */
  async registerRoutineFromExcel(fileId, fileName, planSemanal, userEmail, administrador) {
    try {
      console.log(`📋 Registrando rutina para usuario: ${userEmail}`)
      
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
            administrador: administrador,
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
            administrador: administrador,
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
   * Procesar todos los archivos Excel existentes
   */
  async processExistingExcelFiles() {
    try {
      console.log('🚀 Iniciando procesamiento de archivos Excel existentes...')
      
      // Obtener todos los archivos Excel de documentos_administrador
      const { data: excelFiles, error } = await supabase
        .from('documentos_administrador')
        .select('*')
        .or(`file_type.eq.application/vnd.ms-excel,file_type.eq.application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,file_type.eq.application/vnd.google-apps.spreadsheet,name.ilike.%.xls,name.ilike.%.xlsx,name.ilike.%.xlsm`)

      if (error) {
        console.error('Error obteniendo archivos Excel:', error)
        return
      }

      console.log(`📊 Encontrados ${excelFiles.length} archivos Excel para procesar`)

      for (const file of excelFiles) {
        try {
          console.log(`\n🔍 Procesando: ${file.name} (${file.file_type})`)
          this.processedCount++

          // Verificar si es un archivo Excel
          if (!this.isExcelFile(file.name, file.file_type)) {
            console.log(`⏭️ Saltando ${file.name}: no es un archivo Excel válido`)
            continue
          }

          // Obtener el email del usuario
          const userEmail = await this.getUserEmailFromFolder(file.carpeta_actual)
          
          if (!userEmail) {
            console.log(`⚠️ No se pudo determinar el usuario para ${file.name}`)
            continue
          }

          console.log(`👤 Usuario encontrado: ${userEmail}`)

          // Verificar si ya existe una rutina para este usuario
          const { data: existingRoutine } = await supabase
            .from('rutinas')
            .select('file_id')
            .eq('user_email', userEmail)
            .single()

          if (existingRoutine && existingRoutine.file_id === file.file_id) {
            console.log(`✅ Rutina ya existe para ${userEmail} con este archivo`)
            continue
          }

          // Descargar y procesar el archivo
          try {
            const fileBlob = await googleDriveService.downloadFile(file.file_id)
            const planSemanal = await this.processExcelForRoutine(fileBlob, file.name)
            
            if (planSemanal) {
              // Registrar la rutina
              const success = await this.registerRoutineFromExcel(
                file.file_id,
                file.name,
                planSemanal,
                userEmail,
                file.administrador
              )
              
              if (success) {
                this.routinesRegistered++
                console.log(`🎯 Rutina registrada exitosamente para ${userEmail}`)
              }
            } else {
              console.log(`📋 ${file.name} no cumple con los requisitos de rutina`)
            }
          } catch (downloadError) {
            console.error(`Error descargando ${file.name}:`, downloadError)
            this.errors.push(`${file.name}: ${downloadError.message}`)
          }

        } catch (fileError) {
          console.error(`Error procesando archivo ${file.name}:`, fileError)
          this.errors.push(`${file.name}: ${fileError.message}`)
        }
      }

      // Mostrar resumen
      console.log('\n📊 RESUMEN DEL PROCESAMIENTO:')
      console.log(`✅ Archivos procesados: ${this.processedCount}`)
      console.log(`🎯 Rutinas registradas: ${this.routinesRegistered}`)
      console.log(`❌ Errores: ${this.errors.length}`)
      
      if (this.errors.length > 0) {
        console.log('\n❌ ERRORES ENCONTRADOS:')
        this.errors.forEach(error => console.log(`  - ${error}`))
      }

    } catch (error) {
      console.error('Error en procesamiento general:', error)
    }
  }
}

// Ejecutar el procesamiento
const processor = new ExistingExcelProcessor()
processor.processExistingExcelFiles()
  .then(() => {
    console.log('\n🏁 Procesamiento completado')
    process.exit(0)
  })
  .catch(error => {
    console.error('Error fatal:', error)
    process.exit(1)
  })