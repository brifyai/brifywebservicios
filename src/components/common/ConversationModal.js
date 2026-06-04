import React from 'react'
import { XMarkIcon, ChatBubbleLeftRightIcon, MagnifyingGlassIcon, SparklesIcon, ScaleIcon } from '@heroicons/react/24/outline'

const ConversationModal = ({ isOpen, onClose, conversation }) => {
  if (!isOpen || !conversation) return null

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'chat_general':
        return <ChatBubbleLeftRightIcon className="h-6 w-6 text-purple-600" />
      case 'busqueda_semantica':
        return <MagnifyingGlassIcon className="h-6 w-6 text-green-600" />
      case 'chat_ia':
        return <SparklesIcon className="h-6 w-6 text-blue-600" />
      case 'chat_legal':
        return <ScaleIcon className="h-6 w-6 text-orange-600" />
      default:
        return <ChatBubbleLeftRightIcon className="h-6 w-6 text-gray-600" />
    }
  }

  const getTypeColor = (tipo) => {
    switch (tipo) {
      case 'chat_general':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'busqueda_semantica':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'chat_ia':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'chat_legal':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatearTipo = (tipo) => {
    const tipos = {
      'chat_general': 'Chat General',
      'busqueda_semantica': 'Búsqueda Semántica',
      'chat_ia': 'Chat IA',
      'chat_legal': 'Chat Legal'
    }
    return tipos[tipo] || tipo
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              {getIcon(conversation.tipo)}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Conversación
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(conversation.tipo)}`}>
                    {formatearTipo(conversation.tipo)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatTimestamp(conversation.fecha)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-6">
              {/* Pregunta */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">P</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Pregunta</h4>
                    <p className="text-gray-700 leading-relaxed">{conversation.pregunta}</p>
                  </div>
                </div>
              </div>

              {/* Respuesta */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      {getIcon(conversation.tipo)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Respuesta</h4>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {conversation.respuesta}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                ID: {conversation.id}
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConversationModal