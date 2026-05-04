import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import embeddingsService from '../../lib/embeddings';
import conversationService from '../../services/conversationService';
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
      
      const searchResults = await embeddingsService.searchSimilarContent(
        query,
        user.email,
        10,
        'abogados'
      );
      setResults(searchResults || []);
      
      // Registrar la búsqueda semántica en la base de datos
      try {
        const resultadosTexto = searchResults && searchResults.length > 0 
          ? `Se encontraron ${searchResults.length} resultados relevantes: ${searchResults.slice(0, 3).map(r => r.file_name).join(', ')}`
          : 'No se encontraron resultados para la búsqueda';
          
        await conversationService.registrarConversacion(
          user.email,
          'busqueda_semantica',
          query,
          resultadosTexto
        );
        console.log('✅ Búsqueda semántica registrada exitosamente');
      } catch (error) {
        console.error('❌ Error al registrar búsqueda semántica:', error);
        // No mostramos error al usuario para no interrumpir la experiencia
      }
      
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
    <div className="min-h-screen bg-gray-50">
      {/* Header Principal */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-black rounded-2xl shadow-lg flex items-center justify-center">
              <MagnifyingGlassIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Búsqueda Inteligente</h1>
              <p className="text-gray-600 mt-1">
                Busca contenido en tus documentos y conversa con IA usando inteligencia artificial
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
              <button
                onClick={() => setActiveTab('search')}
                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'search'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MagnifyingGlassIcon className={`mr-2 h-5 w-5 ${
                  activeTab === 'search' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                Búsqueda Semántica
              </button>
              <button
                onClick={() => {
                  setActiveTab('chat');
                  // Prevenir scroll automático en móvil
                  if (window.innerWidth < 768) {
                    setTimeout(() => {
                      window.scrollTo(0, 0);
                    }, 0);
                  }
                }}
                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'chat'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ChatBubbleLeftRightIcon className={`mr-2 h-5 w-5 ${
                  activeTab === 'chat' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                Chat IA
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[calc(100vh-280px)] flex flex-col scroll-to-top-mobile">
          <div className="flex-1 overflow-auto">
            {activeTab === 'search' ? (
              <div>
                {/* Search Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center mb-4">
                    <SparklesIcon className="h-6 w-6 text-blue-600 mr-3" />
                    <h2 className="text-2xl font-bold text-gray-900">Búsqueda Semántica</h2>
                  </div>
                  <p className="text-gray-600">
                    Busca contenido en tus archivos usando inteligencia artificial.
                    Encuentra información relevante incluso si no coinciden las palabras exactas.
                  </p>
                </div>

                {/* Search Form */}
                <div className="p-6">
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Describe lo que estás buscando... (ej: 'documentos sobre marketing digital')"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                        disabled={loading}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading || !query.trim()}
                      className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-lg font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  <div className="border-t border-gray-200">
                    {loading ? (
                      <div className="p-6 flex justify-center">
                        <SubtleSpinner size="md" text="Analizando contenido..." />
                      </div>
                    ) : results.length > 0 ? (
                      <div className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Resultados encontrados ({results.length})
                        </h3>
                        
                        <div className="space-y-4">
                          {results.map((result, index) => (
                            <div key={result.id || index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                              <div className="flex items-start space-x-3">
                                <DocumentIcon className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-medium text-gray-900 truncate">
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
                                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                          title="Ver documento original"
                                        >
                                          <ArrowDownTrayIcon className="h-4 w-4" />
                                        </button>
                                      )}
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                        Relevancia: {(result.similarity * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-sm text-gray-700 mb-2">
                                    <div
                                      className="leading-relaxed"
                                      dangerouslySetInnerHTML={{
                                        __html: highlightText(truncateText(result.content || 'Contenido no disponible'), query)
                                      }}
                                    />
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <div className="flex items-center space-x-4">
                                      <span className="bg-gray-50 px-2 py-1 rounded">ID: {result.id}</span>
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
                                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
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
                        <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No se encontraron resultados
                        </h3>
                        <p className="text-gray-600 mb-4">
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
                  <div className="p-6 bg-blue-50 border-t border-gray-200">
                    <div className="flex items-start space-x-3">
                      <SparklesIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">¿Cómo funciona la búsqueda semántica?</p>
                        <ul className="space-y-1 text-blue-700">
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
      </div>
    </div>
  );
};

export default SemanticSearch;