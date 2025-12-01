import React, { useState } from 'react'
import { Download, FileText, Info, CheckCircle } from 'lucide-react'

const TemplateDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      
      // Crear un enlace temporal para la descarga
      const link = document.createElement('a')
      link.href = '/rutinap.xlsx'
      link.download = 'rutinap.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Simular tiempo de descarga
      setTimeout(() => {
        setIsDownloading(false)
        setDownloadComplete(true)
        
        // Resetear el estado después de 3 segundos
        setTimeout(() => {
          setDownloadComplete(false)
        }, 3000)
      }, 1000)
      
    } catch (error) {
      console.error('Error descargando plantilla:', error)
      setIsDownloading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <FileText className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          📋 Plantilla de Rutinas Personalizadas
        </h2>
        <p className="text-gray-600">
          Descarga nuestra plantilla Excel para organizar tu rutina y dieta
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">¿Qué incluye la plantilla?</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• 📅 Planificación semanal de entrenamientos</li>
              <li>• 🍽️ Registro de comidas y dieta diaria</li>
              <li>• 📊 Seguimiento de progreso y métricas</li>
              <li>• 🎯 Objetivos y metas personalizadas</li>
              <li>• 📝 Notas y observaciones</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0">⏰</div>
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Recordatorios Automáticos</h3>
            <p className="text-yellow-800 text-sm">
              Una vez que subas tu plantilla completada, recibirás recordatorios diarios 
              de tu rutina y dieta todas las mañanas. Además, podrás hacer consultas 
              específicas sobre tu plan a través de nuestro Chat IA.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={handleDownload}
          disabled={isDownloading || downloadComplete}
          className={`
            inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200
            ${downloadComplete 
              ? 'bg-green-600 hover:bg-green-700' 
              : isDownloading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:scale-105'
            }
          `}
        >
          {downloadComplete ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              ¡Descarga Completada!
            </>
          ) : isDownloading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Descargando...
            </>
          ) : (
            <>
              <Download className="w-5 h-5 mr-2" />
              Descargar Plantilla Excel
            </>
          )}
        </button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          📁 Archivo: <span className="font-mono bg-gray-100 px-2 py-1 rounded">rutinap.xlsx</span>
        </p>
        <p className="mt-1">
          💡 Tip: Guarda el archivo con un nombre descriptivo después de completarlo
        </p>
      </div>

      <div className="mt-6 border-t pt-4">
        <h4 className="font-semibold text-gray-900 mb-2">🚀 Próximos pasos:</h4>
        <ol className="text-sm text-gray-600 space-y-1">
          <li>1. Descarga y completa la plantilla con tu información</li>
          <li>2. Sube el archivo a una de tus carpetas en Brify</li>
          <li>3. Activa los recordatorios automáticos</li>
          <li>4. ¡Comienza a recibir recordatorios diarios!</li>
        </ol>
      </div>
    </div>
  )
}

export default TemplateDownload