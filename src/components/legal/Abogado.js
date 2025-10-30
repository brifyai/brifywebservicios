import React, { useState } from 'react'
import {
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import BusquedaLeyes from './BusquedaLeyes'
import ChatLegal from './ChatLegal'

const Abogado = () => {
  const [activeTab, setActiveTab] = useState('busqueda')

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">

        {/* Pestañas */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('busqueda')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'busqueda'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MagnifyingGlassIcon className={`h-5 w-5 ${activeTab === 'busqueda' ? 'text-black' : 'text-gray-400'}`} />
            Búsqueda de Leyes
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChatBubbleLeftRightIcon className={`h-5 w-5 ${activeTab === 'chat' ? 'text-black' : 'text-gray-400'}`} />
            Chat IA Legal
          </button>
        </div>

        {/* Contenido de la pestaña activa */}
        {activeTab === 'busqueda' ? (
          <div>
            {/* Header */}
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mr-4 shadow-lg">
                  <MagnifyingGlassIcon className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Búsqueda de Leyes Chilenas</h2>
              </div>
              <p className="text-gray-600 text-lg">
                Busca en la base de datos de leyes chilenas del BCN. 
                Puedes buscar por título o contenido de la ley.
              </p>
            </div>

            {/* Contenido de Búsqueda de Leyes */}
            <div className="p-8">
              <BusquedaLeyes />
            </div>

            {/* Info */}
            <div className="p-8 bg-gray-50 border-t border-gray-100">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                  <MagnifyingGlassIcon className="h-6 w-6 text-white flex-shrink-0" />
                </div>
                <div className="text-gray-700">
                  <p className="font-semibold mb-3 text-gray-900 text-lg">¿Cómo funciona la búsqueda de leyes?</p>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Busca en la base de datos oficial del Biblioteca del Congreso Nacional</li>
                    <li>• Encuentra leyes por título, número o contenido</li>
                    <li>• Accede al texto completo de las normativas chilenas</li>
                    <li>• Filtra por tipo de norma y fecha de publicación</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ChatLegal />
        )}
      </div>
    </div>
  )
}

export default Abogado