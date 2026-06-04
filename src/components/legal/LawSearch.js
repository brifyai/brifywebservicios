import React, { useState } from 'react'
import { MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

const LawSearch = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_LAWS_URL}/rest/v1/leyes_con_contenido?select=*&contenido=ilike.*${encodeURIComponent(searchQuery)}*`,
        {
          headers: {
            'apikey': process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY,
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Error al buscar en la base de datos de leyes')
      }

      const data = await response.json()
      setSearchResults(data)
    } catch (err) {
      setError(err.message)
      console.error('Error searching laws:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en leyes y normativas..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !searchQuery.trim()}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Buscando...
            </div>
          ) : (
            'Buscar Leyes'
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            Resultados ({searchResults.length})
          </h3>
          <div className="space-y-4">
            {searchResults.map((law, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start">
                  <DocumentTextIcon className="h-5 w-5 text-blue-600 mt-1 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    {law.titulo && (
                      <h4 className="text-md font-semibold text-gray-900 mb-2">
                        {law.titulo}
                      </h4>
                    )}
                    {law.articulo && (
                      <p className="text-sm text-blue-600 mb-2">
                        Artículo: {law.articulo}
                      </p>
                    )}
                    {law.contenido && (
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {law.contenido.length > 500 
                          ? `${law.contenido.substring(0, 500)}...` 
                          : law.contenido
                        }
                      </p>
                    )}
                    {law.fecha && (
                      <p className="text-xs text-gray-500 mt-2">
                        Fecha: {new Date(law.fecha).toLocaleDateString('es-ES')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {searchResults.length === 0 && searchQuery && !loading && !error && (
        <div className="text-center py-8">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron resultados</h3>
          <p className="text-gray-600">
            No se encontraron leyes que coincidan con tu búsqueda.
          </p>
        </div>
      )}
    </div>
  )
}

export default LawSearch