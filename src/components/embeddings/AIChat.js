import React, { useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import embeddingsService from '../../lib/embeddings'
import groqService from '../../services/groqService'
import SubtleSpinner from '../common/SubtleSpinner'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  DocumentIcon,
  UserIcon,
  CpuChipIcon
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

  // Scroll automático eliminado para evitar comportamiento no deseado
  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  // }

  // useEffect(() => {
  //   scrollToBottom()
  // }, [messages, isTyping])

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
      // Buscar contenido relevante usando embeddings
      const searchResults = await embeddingsService.searchSimilarContent(userMessage, user.id, 5)
      
      // Preparar contexto de documentos
      const context = searchResults?.map(result => ({
        content: result.content,
        file_name: result.file_name,
        similarity: result.similarity
      })) || []

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
        user.id // Pasar userId para tracking de tokens
      )

      // Agregar respuesta de la IA
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: groqResult.response,
        timestamp: new Date(),
        context: context.length > 0 ? context : null,
        searchResults: searchResults?.length || 0,
        tokensUsed: groqResult.tokensUsed
      }
      
      setMessages(prev => [...prev, aiMessage])
      
      if (context.length > 0) {
        toast.success(`Respuesta generada usando ${context.length} documentos relevantes (${groqResult.tokensUsed} tokens)`)
      } else {
        toast.success(`Respuesta generada (${groqResult.tokensUsed} tokens utilizados)`)
      }
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
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mr-4 shadow-lg">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Chat IA</h2>
          </div>
          <p className="text-gray-600 text-lg">
            Conversa con tus documentos usando inteligencia artificial.
            Obtén respuestas precisas basadas en tu contenido.
          </p>
        </div>

        {/* Chat Container */}
        {/* Messages Area */}
        <div className="h-96 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full mb-6 border-2 border-blue-300">
                <SparklesIcon className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                ¡Hola! Soy tu asistente IA
              </h3>
              <p className="text-gray-600 text-lg max-w-lg mb-6">
                Puedes hacerme preguntas sobre tus documentos. Buscaré información relevante y te daré respuestas precisas.
              </p>
              <div className="text-sm text-gray-600 bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl max-w-md border border-blue-200">
                <p className="font-semibold mb-3 text-blue-800">💡 Ejemplos de preguntas:</p>
                <ul className="space-y-2">
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
                  <div className="flex items-start space-x-4">
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-md">
                          <CpuChipIcon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    )}
                    
                    <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                      <div
                        className={`inline-block p-4 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md'
                            : message.isError
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : 'bg-gradient-to-br from-blue-50 to-white text-gray-900 border border-blue-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                      
                      {/* Context info for AI messages */}
                      {message.role === 'assistant' && (
                        <div className="mt-3 text-xs text-gray-500 space-y-2">
                          {message.context && message.context.length > 0 && (
                            <div className="flex items-center space-x-2 bg-gradient-to-r from-blue-100 to-blue-50 px-3 py-2 rounded-full border border-blue-200">
                              <DocumentIcon className="h-4 w-4 text-blue-600" />
                              <span className="text-blue-800">Basado en {message.context.length} documento(s) relevante(s)</span>
                            </div>
                          )}
                          {message.tokensUsed && (
                            <div className="flex items-center space-x-2 bg-gradient-to-r from-blue-100 to-blue-50 px-3 py-2 rounded-full border border-blue-200">
                              <CpuChipIcon className="h-4 w-4 text-blue-600" />
                              <span className="text-blue-800">{message.tokensUsed} tokens utilizados</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-400">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                    
                    {message.role === 'user' && (
                      <div className="flex-shrink-0">
                        <div className="p-3 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full shadow-md">
                          <UserIcon className="h-5 w-5 text-white" />
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
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-md">
                  <CpuChipIcon className="h-5 w-5 text-white" />
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-4 border border-blue-200">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-100 p-6">
          <form onSubmit={handleSendMessage} className="flex space-x-4">
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Escribe tu pregunta aquí..."
                disabled={loading}
                className="w-full px-5 py-4 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-black focus:border-black disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-400 shadow-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-lg flex items-center space-x-3"
            >
              {loading ? (
                <SubtleSpinner size="sm" />
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
              <span className="hidden sm:inline font-medium">Enviar</span>
            </button>
          </form>
        </div>
      </div>

      {/* Info */}
      <div className="p-8 bg-gray-50 border-t border-gray-100">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
            <SparklesIcon className="h-6 w-6 text-white flex-shrink-0" />
          </div>
          <div className="text-gray-700">
            <p className="font-semibold mb-3 text-gray-900 text-lg">¿Cómo funciona el Chat IA?</p>
            <ul className="space-y-2 text-gray-600">
              <li>• Busca automáticamente en tus documentos información relevante</li>
              <li>• Mantiene el contexto de la conversación para respuestas coherentes</li>
              <li>• Te indica qué documentos usó para generar cada respuesta</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIChat