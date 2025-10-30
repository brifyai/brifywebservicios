import React, { useState } from 'react'
import { MagnifyingGlassIcon, DocumentTextIcon, CalendarIcon, LinkIcon } from '@heroicons/react/24/outline'

const BusquedaLeyes = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedContent, setExpandedContent] = useState(new Set())

  const searchLaws = async () => {
    if (!searchTerm.trim()) {
      setError('Por favor ingresa un término de búsqueda')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_LAWS_URL}/rest/v1/leyes_con_contenido?select=*&or=(${encodeURIComponent('Título de la Norma')}.ilike.*${encodeURIComponent(searchTerm)}*,${encodeURIComponent('Contenido')}.ilike.*${encodeURIComponent(searchTerm)}*)`,
        {
          headers: {
            'apikey': process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY,
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Error al buscar leyes')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError('Error al realizar la búsqueda. Intenta nuevamente.')
      console.error('Error searching laws:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    searchLaws()
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No disponible'
    return new Date(dateString).toLocaleDateString('es-CL')
  }

  const truncateContent = (content, maxLength = 300) => {
    if (!content) return 'Contenido no disponible'
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
  }

  const toggleContentExpansion = (index) => {
    const newExpanded = new Set(expandedContent)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedContent(newExpanded)
  }

  return (
    <div className="p-6">
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar leyes por título o contenido..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </h3>
          
          {results.map((law, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">
                    {law['Título de la Norma'] || 'Título no disponible'}
                  </h4>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                    {law['Fecha de Publicación'] && (
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        <span>Publicación: {law['Fecha de Publicación']}</span>
                      </div>
                    )}
                    
                    {law['Año de Publicación'] && (
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                        <span>Año: {law['Año de Publicación']}</span>
                      </div>
                    )}
                    
                    {law['Es modificatoria'] === 'Sí' && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                        Modificatoria
                      </span>
                    )}
                    
                    {law['Derogado'] && (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                        Derogada
                      </span>
                    )}
                  </div>
                </div>
                
                {law['Url'] && (
                  <a
                    href={law['Url']}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <LinkIcon className="h-4 w-4 mr-1" />
                    <span className="text-sm">Ver en BCN</span>
                  </a>
                )}
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h5 className="font-medium text-gray-900 mb-2">Contenido:</h5>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                  {expandedContent.has(index) ? law['Contenido'] || 'Contenido no disponible' : truncateContent(law['Contenido'])}
                </p>
                
                {law['Contenido'] && law['Contenido'].length > 300 && (
                  <button 
                    onClick={() => toggleContentExpansion(index)}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                  >
                    {expandedContent.has(index) ? 'Ver menos' : 'Ver contenido completo'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && searchTerm && (
        <div className="text-center py-8">
          <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron resultados</h3>
          <p className="text-gray-600">Intenta con otros términos de búsqueda</p>
        </div>
      )}

      {/* Initial State */}
      {!searchTerm && results.length === 0 && (
        <div className="text-center py-12">
          <MagnifyingGlassIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Búsqueda de Leyes Chilenas</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Busca en la base de datos de leyes chilenas del BCN. Puedes buscar por título o contenido de la ley.
          </p>
        </div>
      )}
    </div>
  )
}

export default BusquedaLeyes