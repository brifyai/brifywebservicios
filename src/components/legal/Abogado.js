import React, { useState } from 'react'
import { 
  MagnifyingGlassIcon, 
  ChatBubbleLeftRightIcon,
  ScaleIcon
} from '@heroicons/react/24/outline'
import BusquedaLeyes from './BusquedaLeyes'
import ChatLegal from './ChatLegal'

const Abogado = () => {
  const [activeTab, setActiveTab] = useState('busqueda')

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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <ScaleIcon className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Servicios Legales</h1>
            <p className="text-gray-600 mt-1">
              Herramientas especializadas para consultas y verificación de documentos legales
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
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
      <div className="bg-white rounded-lg shadow-md">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}

export default Abogado