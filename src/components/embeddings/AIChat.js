import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import groqService from '../../services/groqService'
import conversationService from '../../services/conversationService'
import LoadingSpinner from '../common/LoadingSpinner'
import SubtleSpinner from '../common/SubtleSpinner'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  DocumentIcon,
  UserIcon,
  CpuChipIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const AIChat = () => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    // Solo hacer scroll en versión desktop para evitar el scroll automático en móvil
    if (window.innerWidth >= 768) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    // Solo hacer scroll si hay mensajes Y es versión desktop (evitar scroll al cambiar de pestaña en móvil)
    if (messages.length > 0 && window.innerWidth >= 768) {
      // Pequeño delay para asegurar que el DOM está listo
      setTimeout(() => scrollToBottom(), 50)
    }
  }, [messages]) // Solo reaccionar a cambios en mensajes, no en isTyping

  useEffect(() => {
    // Scroll adicional cuando termina de escribir solo en versión desktop
    if (!isTyping && messages.length > 0 && window.innerWidth >= 768) {
      setTimeout(() => scrollToBottom(), 100)
    }
  }, [isTyping])

  // Forzar scroll a arriba en móvil cuando el componente se monta
  useEffect(() => {
    if (window.innerWidth < 768) {
      // Prevenir scroll del body y html
      const originalBodyStyle = document.body.style.scrollBehavior
      const originalHtmlStyle = document.documentElement.style.scrollBehavior
      
      document.body.style.scrollBehavior = 'auto'
      document.documentElement.style.scrollBehavior = 'auto'
      
      // Forzar scroll a la parte superior inmediatamente
      window.scrollTo(0, 0)
      
      // También forzar scroll del contenedor principal si existe
      const mainContainer = document.querySelector('main')
      if (mainContainer) {
        mainContainer.scrollTop = 0
      }
      
      // Restaurar scroll behavior después de un tiempo más largo
      setTimeout(() => {
        document.body.style.scrollBehavior = originalBodyStyle
        document.documentElement.style.scrollBehavior = originalHtmlStyle
      }, 300)
      
      // Prevenir scroll por foco del input
      setTimeout(() => {
        window.scrollTo(0, 0)
      }, 100)
    }
  }, []) // Solo se ejecuta al montar el componente

  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!inputMessage.trim() || loading) {
      return
    }

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setLoading(true)
    setIsTyping(true)

    // Agregar mensaje del usuario
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      // Chat general: no usar matching de documentos ni contexto embebido
      const context = []

      // Preparar historial de chat (últimos 6 mensajes para contexto)
      const chatHistory = messages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Generar respuesta con GROQ
      const groqResult = await groqService.generateChatResponse(
        userMessage,
        context,
        chatHistory,
        user.id
      )

      // Agregar respuesta de la IA
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: groqResult.response,
        timestamp: new Date(),
        context: null,
        searchResults: 0,
        tokensUsed: groqResult.tokensUsed
      }
      
      setMessages(prev => [...prev, aiMessage])
      
      // Registrar la conversación en la base de datos
      try {
        await conversationService.registrarConversacion(
          user.email,
          'chat_ia',
          userMessage,
          groqResult.response
        )
        console.log('✅ Conversación registrada exitosamente')
      } catch (error) {
        console.error('❌ Error al registrar conversación:', error)
        // No mostramos error al usuario para no interrumpir la experiencia
      }
      
      toast.success(`Respuesta generada (${groqResult.tokensUsed} tokens utilizados)`) 
    } catch (error) {
      console.error('Error in AI chat:', error)
      toast.error('Error al generar respuesta: ' + error.message)
      
      // Agregar mensaje de error
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta nuevamente.',
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages([])
    toast.success('Chat limpiado')
  }

  const formatTimestamp = (timestamp) => {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Chat IA</h2>
              <p className="text-gray-600">Haz preguntas libremente; la IA responde según su conocimiento</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Limpiar Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-blue-50 rounded-full mb-4">
              <SparklesIcon className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">¡Hola! Soy tu asistente IA</h3>
            <p className="text-gray-600 max-w-md">Puedes hacerme preguntas de cualquier tema. Responderé según mi conocimiento y el contexto de la conversación.</p>
            <div className="mt-4 text-sm text-gray-500">
              <p>💡 Ejemplos de preguntas:</p>
              <ul className="mt-2 space-y-1">
                <li>• "¿Qué dice el documento sobre...?"</li>
                <li>• "Resume los puntos principales"</li>
                <li>• "Busca información sobre..."</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-3xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div className="flex items-start space-x-3">
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <CpuChipIcon className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`inline-block p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : message.isError
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    {/* Context info for AI messages */}
                    {message.role === 'assistant' && (
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        {message.context && message.context.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <DocumentIcon className="h-3 w-3" />
                            <span>Basado en {message.context.length} documento(s) relevante(s)</span>
                          </div>
                        )}
                        {message.tokensUsed && (
                          <div className="flex items-center space-x-1">
                            <CpuChipIcon className="h-3 w-3" />
                            <span>{message.tokensUsed} tokens utilizados</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-1 text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-blue-600 rounded-full">
                        <UserIcon className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <CpuChipIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-6">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Escribe tu pregunta aquí..."
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus={window.innerWidth >= 768} // Solo autoFocus en desktop
            />
          </div>
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <SubtleSpinner size="sm" />
            ) : (
              <PaperAirplaneIcon className="h-5 w-5" />
            )}
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>

      {/* Info Panel */}
      <div className="border-t border-gray-200 bg-blue-50 p-6">
        <div className="flex items-start space-x-3">
          <SparklesIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">¿Cómo funciona el Chat IA?</p>
            <ul className="space-y-1 text-blue-700">
              <li>• Responde según su conocimiento general</li>
              <li>• Mantiene el contexto de la conversación para respuestas coherentes</li>
              <li>• Puede estructurar y citar cuando sea útil</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIChat