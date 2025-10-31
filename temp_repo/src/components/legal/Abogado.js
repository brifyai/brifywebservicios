import React, { useState, useEffect } from 'react'
import { 
  MagnifyingGlassIcon, 
  ChatBubbleLeftRightIcon,
  ScaleIcon
} from '@heroicons/react/24/outline'
import BusquedaLeyes from './BusquedaLeyes'
import ChatLegal from './ChatLegal'

const Abogado = () => {
  const [activeTab, setActiveTab] = useState('busqueda')

  // Efecto para asegurar scroll al top en móvil al cargar la página
  useEffect(() => {
    // Forzar scroll al inicio en versión móvil
    if (window.innerWidth < 768) {
      window.scrollTo(0, 0)
    }
  }, [])

  const tabs = [
    {
      id: 'busqueda',
      name: 'Búsqueda de Leyes',
      icon: MagnifyingGlassIcon,
      component: BusquedaLeyes
    },
    {
      id: 'chat',
      name: 'Chat IA Legal',
      icon: ChatBubbleLeftRightIcon,
      component: ChatLegal
    }
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component

  return (
    <div className="min-h-screen bg-gray-50 scroll-to-top-mobile">
      {/* Header Principal */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-black rounded-2xl shadow-lg flex items-center justify-center">
              <ScaleIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Servicios Legales</h1>
              <p className="text-gray-600 mt-1">
                Herramientas especializadas para consultas y verificación de documentos legales
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`mr-2 h-5 w-5 ${
                      activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[calc(100vh-280px)] flex flex-col">
          <div className="flex-1 overflow-auto p-6">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Abogado