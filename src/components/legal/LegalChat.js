import React, { useState, useRef } from 'react'
import { ChatBubbleLeftRightIcon, DocumentArrowUpIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline'

const LegalChat = () => {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileUpload = (files) => {
    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return validTypes.includes(file.type)
    })

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() && uploadedFiles.length === 0) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      files: uploadedFiles.map(f => f.name),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setLoading(true)

    try {
      // Simular respuesta de IA (aquí integrarías con tu servicio de IA)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const aiResponse = {
        id: Date.now() + 1,
        type: 'ai',
        content: generateAIResponse(inputMessage, uploadedFiles),
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiResponse])
      setUploadedFiles([])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Error al procesar tu consulta. Por favor, intenta nuevamente.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const generateAIResponse = (message, files) => {
    if (files.length > 0) {
      return `He analizado el documento "${files[0].name}". Basándome en las leyes vigentes y el contenido del documento, puedo ayudarte con consultas específicas sobre su validez legal, cláusulas importantes, o posibles mejoras. ¿Qué aspecto específico te gustaría que revise?`
    }
    
    if (message.toLowerCase().includes('contrato')) {
      return 'Para analizar un contrato correctamente, necesito que subas el documento. Podré revisar cláusulas, identificar posibles problemas legales y sugerir mejoras basándome en la legislación actual.'
    }
    
    return 'Soy tu asistente legal especializado. Puedo ayudarte a analizar documentos, revisar contratos, y responder consultas sobre legislación. Para un análisis más preciso, sube tu documento y hazme preguntas específicas.'
  }

  return (
    <div className="flex flex-col h-96">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-t-lg">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Chat Legal IA</h3>
            <p className="text-gray-600">
              Sube documentos PDF o DOCX y haz consultas legales especializadas.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : message.type === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-white text-gray-800 shadow'
              }`}>
                <p className="text-sm">{message.content}</p>
                {message.files && message.files.length > 0 && (
                  <div className="mt-2 text-xs opacity-75">
                    📎 {message.files.join(', ')}
                  </div>
                )}
                <p className="text-xs mt-1 opacity-75">
                  {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 shadow max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm">Analizando...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Upload Area */}
      {uploadedFiles.length > 0 && (
        <div className="p-3 bg-blue-50 border-t border-blue-200">
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center bg-white rounded-md px-3 py-1 text-sm">
                <PaperClipIcon className="h-4 w-4 text-gray-400 mr-2" />
                <span className="truncate max-w-32">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white rounded-b-lg border-t border-gray-200">
        {/* Drag and Drop Area */}
        <div
          className={`mb-3 border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <DocumentArrowUpIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            Arrastra archivos PDF o DOCX aquí, o haz clic para seleccionar
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Escribe tu consulta legal..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || (!inputMessage.trim() && uploadedFiles.length === 0)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}

export default LegalChat