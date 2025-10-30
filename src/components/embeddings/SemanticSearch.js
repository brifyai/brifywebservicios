import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import embeddingsService from '../../lib/embeddings';
import LoadingSpinner from '../common/LoadingSpinner';
import SubtleSpinner from '../common/SubtleSpinner';
import AIChat from './AIChat';
import {
  MagnifyingGlassIcon,
  DocumentIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const SemanticSearch = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('search'); // 'search' o 'chat'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error('Por favor ingresa una consulta de búsqueda');
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);
      
      const searchResults = await embeddingsService.searchSimilarContent(query, user.id, 10);
      setResults(searchResults || []);
      
      if (searchResults && searchResults.length > 0) {
        toast.success(`Se encontraron ${searchResults.length} resultados`);
      } else {
        toast.info('No se encontraron resultados para tu búsqueda');
      }
    } catch (error) {
      console.error('Error in semantic search:', error);
      toast.error('Error al realizar la búsqueda semántica');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    
    const words = query.toLowerCase().split(' ');
    let highlightedText = text;
    
    words.forEach(word => {
      if (word.length > 2) {
        const regex = new RegExp(`(${word})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
      }
    });
    
    return highlightedText;
  };

  const truncateText = (text, maxLength = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        {/* Pestañas */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'search'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MagnifyingGlassIcon className={`h-5 w-5 ${activeTab === 'search' ? 'text-black' : 'text-gray-400'}`} />
            Búsqueda por Texto
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
            Chat IA
          </button>
        </div>

        {/* Contenido de la pestaña activa */}
        {activeTab === 'search' ? (
          <div>
            {/* Header */}
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mr-4 shadow-lg">
                  <SparklesIcon className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Búsqueda por Texto</h2>
              </div>
              <p className="text-gray-600 text-lg">
                Busca contenido en tus archivos usando inteligencia artificial.
                Encuentra información relevante incluso si no coinciden las palabras exactas.
              </p>
            </div>

            {/* Search Form */}
            <div className="p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe lo que estás buscando... (ej: 'documentos sobre marketing digital')"
                className="block w-full pl-12 pr-4 py-4 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-black focus:border-black text-lg placeholder-gray-400 shadow-sm"
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <SubtleSpinner size="sm" />
                  <span className="ml-2">Buscando...</span>
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                  Buscar con IA
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="border-t border-gray-800 bg-black">
            {loading ? (
              <div className="p-6 flex justify-center">
                <SubtleSpinner size="md" text="Analizando contenido..." />
              </div>
            ) : results.length > 0 ? (
              <div className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  Resultados encontrados ({results.length})
                </h3>
                
                <div className="space-y-4">
                  {results.map((result, index) => (
                    <div key={result.id || index} className="border border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-200 bg-gray-900 hover:bg-gray-800">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-blue-500 rounded-lg">
                          <DocumentIcon className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-white truncate">
                              {result.metadata?.name || result.metadata?.file_name || `Documento ${result.id}`}
                            </h4>
                            <div className="flex items-center space-x-2">
                              {result.metadata?.file_id && (
                                <button
                                  onClick={() => {
                                    if (result.metadata.file_id) {
                                      window.open(`https://drive.google.com/file/d/${result.metadata.file_id}/view`, '_blank');
                                    }
                                  }}
                                  className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                                  title="Ver documento original"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                </button>
                              )}
                              <span className="text-xs text-white bg-gradient-to-r from-blue-500 to-blue-600 px-2 py-1 rounded-full font-medium">
                                Relevancia: {(result.similarity * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-sm text-gray-300 mb-2">
                            <div
                              className="leading-relaxed"
                              dangerouslySetInnerHTML={{
                                __html: highlightText(truncateText(result.content || 'Contenido no disponible'), query)
                              }}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <div className="flex items-center space-x-4">
                              <span className="bg-gray-800 px-2 py-1 rounded text-gray-300">ID: {result.id}</span>
                              {result.created_at && (
                                <span className="flex items-center">
                                  📅 {new Date(result.created_at).toLocaleDateString('es-ES')}
                                </span>
                              )}
                              {result.metadata?.correo && (
                                <span className="flex items-center">
                                  👤 {result.metadata.correo}
                                </span>
                              )}
                            </div>
                            {result.metadata?.file_type && (
                              <span className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs">
                                {result.metadata.file_type.split('/').pop().toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <ExclamationTriangleIcon className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  No se encontraron resultados
                </h3>
                <p className="text-gray-400 mb-4">
                  No se encontró contenido relacionado con tu búsqueda.
                </p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>• Intenta con términos más generales</p>
                  <p>• Verifica que tengas archivos procesados</p>
                  <p>• Asegúrate de que los archivos contengan texto</p>
                </div>
              </div>
            )}
          </div>
        )}

            {/* Info */}
            {!hasSearched && (
              <div className="p-8 bg-gray-50 border-t border-gray-100">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                    <SparklesIcon className="h-6 w-6 text-white flex-shrink-0" />
                  </div>
                  <div className="text-gray-700">
                    <p className="font-semibold mb-3 text-gray-900 text-lg">¿Cómo funciona la búsqueda por texto?</p>
                    <ul className="space-y-2 text-gray-600">
                      <li>• Utiliza IA para entender el significado de tu consulta</li>
                      <li>• Encuentra contenido relevante aunque no coincidan las palabras exactas</li>
                      <li>• Busca en todos tus archivos procesados automáticamente</li>
                      <li>• Ordena los resultados por relevancia semántica</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <AIChat />
        )}
      </div>
    </div>
  );
};

export default SemanticSearch;