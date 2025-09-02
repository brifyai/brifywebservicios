import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import googleDriveService from '../../lib/googleDrive'
import * as XLSX from 'xlsx'
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const RoutineUpload = ({ onUploadComplete, onClose }) => {
  const { user, userProfile } = useAuth()
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [folders, setFolders] = useState([])
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState('')

  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    try {
      setLoadingFolders(true)
      const { data, error } = await supabase
        .from('carpetas_usuario')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error loading folders:', error)
      toast.error('Error cargando carpetas')
    } finally {
      setLoadingFolders(false)
    }
  }

  // Función para procesar el Excel y convertirlo al formato requerido
  const processExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          
          // Verificar que existan las hojas requeridas
          const requiredSheets = ['Rutina de Ejercicios', 'Alimentación']
          const availableSheets = workbook.SheetNames
          
          const missingSheets = requiredSheets.filter(sheet => !availableSheets.includes(sheet))
          if (missingSheets.length > 0) {
            reject(new Error(`Faltan las siguientes hojas en el Excel: ${missingSheets.join(', ')}`))
            return
          }

          // Leer datos de ambas hojas
          const rutinaSheet = workbook.Sheets['Rutina de Ejercicios']
          const alimentacionSheet = workbook.Sheets['Alimentación']
          
          const rutinaData = XLSX.utils.sheet_to_json(rutinaSheet)
          const alimentacionData = XLSX.utils.sheet_to_json(alimentacionSheet)
          
          // Procesar datos usando la lógica de codejemplos.js
          const planSemanal = processRoutineData(rutinaData, alimentacionData)
          
          resolve(planSemanal)
        } catch (error) {
          reject(new Error(`Error procesando el archivo Excel: ${error.message}`))
        }
      }
      
      reader.onerror = () => reject(new Error('Error leyendo el archivo'))
      reader.readAsArrayBuffer(file)
    })
  }

  // Función para procesar los datos de rutina y alimentación
  const processRoutineData = (rutinaData, alimentacionData) => {
    const planSemanal = {
      lunes: { ejercicios: [], alimentacion: [] },
      martes: { ejercicios: [], alimentacion: [] },
      miercoles: { ejercicios: [], alimentacion: [] },
      jueves: { ejercicios: [], alimentacion: [] },
      viernes: { ejercicios: [], alimentacion: [] },
      sabado: { ejercicios: [], alimentacion: [] },
      domingo: { ejercicios: [], alimentacion: [] }
    }

    // Procesar datos de rutina
    rutinaData.forEach(row => {
      const dia = row['Día']?.toLowerCase()
      if (dia && planSemanal[dia]) {
        planSemanal[dia].ejercicios.push({
          ejercicio: row['Ejercicio'] || '',
          series: row['Series'] || '',
          repeticiones: row['Repeticiones'] || '',
          peso: row['Peso'] || '',
          descanso: row['Descanso'] || '',
          notas: row['Notas'] || ''
        })
      }
    })

    // Procesar datos de alimentación
    alimentacionData.forEach(row => {
      const dia = row['Día']?.toLowerCase()
      if (dia && planSemanal[dia]) {
        planSemanal[dia].alimentacion.push({
          comida: row['Comida'] || '',
          alimento: row['Alimento'] || '',
          cantidad: row['Cantidad'] || '',
          calorias: row['Calorías'] || '',
          proteinas: row['Proteínas'] || '',
          carbohidratos: row['Carbohidratos'] || '',
          grasas: row['Grasas'] || ''
        })
      }
    })

    return planSemanal
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validar que sea un archivo Excel
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
      
      if (!validTypes.includes(file.type)) {
        toast.error('Por favor selecciona un archivo Excel (.xls o .xlsx)')
        return
      }
      
      setSelectedFile(file)
    }
  }

  // Manejar subida de rutina
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Por favor selecciona un archivo')
      return
    }

    if (!selectedFolder) {
      toast.error('Por favor selecciona una carpeta')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(10)

      // Procesar el archivo Excel
      const planSemanal = await processExcelFile(selectedFile)
      setUploadProgress(30)

      // Obtener información de la carpeta seleccionada
      const { data: folderData, error: folderError } = await supabase
        .from('carpetas_usuario')
        .select('*')
        .eq('id', selectedFolder)
        .single()

      if (folderError) throw folderError
      
      const folderName = folderData.folder_name || folderData.correo
      setUploadProgress(50)

      // Subir archivo a Google Drive
      await googleDriveService.setTokens({
        refresh_token: userProfile.google_refresh_token
      })

      const googleFileId = await googleDriveService.uploadFile(
        selectedFile,
        folderData.google_folder_id
      )
      setUploadProgress(70)

      // Verificar si ya existe una rutina para este usuario
      const { data: existingRoutine, error: checkError } = await supabase
        .from('rutinas')
        .select('*')
        .eq('user_email', folderName)
        .single()

      let result
      if (existingRoutine) {
        // Actualizar rutina existente
        result = await supabase
          .from('rutinas')
          .update({
            plan_semanal: planSemanal,
            updated_at: new Date().toISOString()
          })
          .eq('user_email', folderName)
      } else {
        // Crear nueva rutina
        result = await supabase
          .from('rutinas')
          .insert({
            user_email: folderName,
            plan_semanal: planSemanal
          })
      }
      
      if (result.error) throw result.error
      
      setUploadProgress(90)
      
      // Registrar en documentos_usuario_entrenador
      const { error: docError } = await supabase
        .from('documentos_usuario_entrenador')
        .insert({
          usuario: folderName,
          file_name: selectedFile.name,
          file_type: 'routine',
          file_id: googleFileId
        })
      
      if (docError) {
        console.warn('Error registrando en documentos_usuario_entrenador:', docError)
      }
      
      setUploadProgress(100)
      
      toast.success(existingRoutine ? 'Rutina actualizada exitosamente' : 'Rutina subida exitosamente')
      
      // Limpiar estado
      setSelectedFile(null)
      setUploadProgress(0)
      
      // Llamar callback
      if (onUploadComplete) {
        onUploadComplete()
      }
      
    } catch (error) {
      console.error('Error uploading routine:', error)
      toast.error(`Error subiendo rutina: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Subir Rutina de Entrenamiento
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Selector de carpeta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Carpeta de destino
            </label>
            {loadingFolders ? (
              <LoadingSpinner size="sm" />
            ) : (
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={uploading}
              >
                <option value="">Seleccionar carpeta</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.folder_name || folder.correo}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Selector de archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivo Excel de Rutina
            </label>
            <input
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={uploading}
            />
            {selectedFile && (
              <div className="mt-2 text-sm text-gray-600 flex items-center">
                <DocumentTextIcon className="h-4 w-4 mr-1" />
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
          
          {/* Progreso de subida */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subiendo rutina...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Información */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Formato requerido:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Archivo Excel (.xls o .xlsx)</li>
                  <li>Hoja "Rutina de Ejercicios"</li>
                  <li>Hoja "Alimentación"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* Botones */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedFolder || uploading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {uploading ? (
              <>
                <div className="w-3 h-3 mr-2 animate-spin">
                  <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                </div>
                Subiendo...
              </>
            ) : (
              <>
                <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                Subir Rutina
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RoutineUpload