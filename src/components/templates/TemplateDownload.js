import React from 'react'
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const TemplateDownload = () => {
  const downloadTemplate = async () => {
    try {
      // Crear un enlace de descarga para el archivo rutinap.xlsx
      const response = await fetch('/rutinap.xlsx')
      
      if (!response.ok) {
        throw new Error('Error descargando la plantilla')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'rutinap.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Plantilla descargada exitosamente')
    } catch (error) {
      console.error('Error descargando plantilla:', error)
      toast.error('Error descargando la plantilla')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center mb-4">
        <DocumentArrowDownIcon className="h-8 w-8 text-blue-600 mr-3" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Plantilla de Rutina</h3>
          <p className="text-sm text-gray-600">Descarga la plantilla Excel para configurar tu rutina</p>
        </div>
      </div>
      
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-blue-900 mb-2">¿Qué incluye la plantilla?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Planificación semanal de ejercicios</li>
          <li>• Registro de dieta diaria</li>
          <li>• Seguimiento de objetivos</li>
          <li>• Notas personalizadas</li>
        </ul>
      </div>
      
      <div className="bg-yellow-50 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-yellow-900 mb-2">📋 Instrucciones:</h4>
        <ol className="text-sm text-yellow-800 space-y-1">
          <li>1. Descarga la plantilla haciendo clic en el botón</li>
          <li>2. Completa tu rutina y dieta en Excel</li>
          <li>3. Sube el archivo completado a tu carpeta en Google Drive</li>
          <li>4. ¡Recibe recordatorios diarios automáticos!</li>
        </ol>
      </div>
      
      <button
        onClick={downloadTemplate}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
      >
        <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
        Descargar Plantilla rutinap.xlsx
      </button>
      
      <p className="text-xs text-gray-500 mt-3 text-center">
        Archivo Excel compatible con Microsoft Excel, Google Sheets y LibreOffice
      </p>
    </div>
  )
}

export default TemplateDownload