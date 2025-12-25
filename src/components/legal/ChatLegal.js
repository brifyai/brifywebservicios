import React, { useState, useRef, useEffect } from 'react'
import { 
  ChatBubbleLeftRightIcon, 
  DocumentArrowUpIcon, 
  PaperClipIcon,
  XMarkIcon,
  UserIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline'
import { supabase } from '../../lib/supabase'
import fileExtractor from '../../services/fileContentExtractor'
import groqService from '../../services/groqService'
import conversationService from '../../services/conversationService'
import { useAuth } from '../../contexts/AuthContext'

const ChatLegal = () => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tokensUsed, setTokensUsed] = useState(0)
  const [currentLaw, setCurrentLaw] = useState(null)
  const fileInputRef = useRef(null)

  // Efecto para asegurar scroll al top en móvil al cargar el componente
  useEffect(() => {
    // Forzar scroll al inicio en versión móvil
    if (window.innerWidth < 768) {
      window.scrollTo(0, 0)
    }
  }, [])

  // Cargar uso actual de tokens al inicializar
  useEffect(() => {
    const loadTokenUsage = async () => {
      if (!user?.id) return
      
      try {
        const { data, error } = await supabase
          .from('user_tokens_usage')
          .select('tokens_used')
          .eq('user_id', user.id)
          .single()
        
        if (data && !error) {
          setTokensUsed(data.tokens_used || 0)
        }
      } catch (error) {
        console.error('Error loading token usage:', error)
      }
    }
    
    loadTokenUsage()
  }, [user?.id])

  // Función para registrar el uso de tokens
  const trackTokenUsage = async (inputTokens, outputTokens, operation = 'legal_analysis') => {
    if (!user?.id) return
    
    try {
      const totalTokens = inputTokens + outputTokens
      
      // Obtener el uso actual de tokens del usuario
      const { data: currentUsage, error: fetchError } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used')
        .eq('user_id', user.id)
        .single()
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching current token usage:', fetchError)
        return
      }
      
      const currentTokensUsed = currentUsage?.tokens_used || 0
      const newTokensUsed = currentTokensUsed + totalTokens
      
      // Actualizar el uso de tokens
      const { error: updateError } = await supabase
        .from('user_tokens_usage')
        .upsert({
          user_id: user.id,
          tokens_used: newTokensUsed,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
      
      if (updateError) {
        console.error('Error updating token usage:', updateError)
      } else {
        setTokensUsed(newTokensUsed)
        console.log(`Tokens registrados - Entrada: ${inputTokens}, Salida: ${outputTokens}, Total: ${totalTokens}, Operación: ${operation}`)
      }
    } catch (error) {
      console.error('Error tracking token usage:', error)
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && (file.type === 'application/pdf' || file.type.includes('document'))) {
      setUploadedFile(file)
    } else {
      alert('Por favor selecciona un archivo PDF o DOC/DOCX')
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Función para extraer términos legales clave del documento
  const extractLegalTerms = (content) => {
    if (!content) return []
    
    const legalTerms = [
      'contrato', 'acuerdo', 'convenio', 'clausula', 'termino', 'condicion',
      'derecho', 'obligacion', 'responsabilidad', 'garantia', 'indemnizacion',
      'nacionalidad', 'ciudadania', 'residencia', 'visa', 'permiso',
      'matrimonio', 'divorcio', 'pension', 'alimentos', 'custodia',
      'propiedad', 'arrendamiento', 'compraventa', 'hipoteca', 'usufructo',
      'trabajo', 'empleo', 'despido', 'finiquito', 'liquidacion',
      'sociedad', 'empresa', 'comercio', 'tributario', 'impuesto',
      'penal', 'delito', 'falta', 'sancion', 'multa',
      'constitucional', 'administrativo', 'civil', 'laboral', 'comercial'
    ]
    
    const contentLower = content.toLowerCase()
    const foundTerms = legalTerms.filter(term => 
      contentLower.includes(term)
    )
    
    // Detectar números de ley específicos en el contenido
    const lawNumbers = content.match(/ley\s*(\d+)/gi) || []
    const extractedLawNumbers = lawNumbers.map(match => {
      const number = match.match(/\d+/)[0]
      return `ley ${number}`
    })
    
    return [...new Set([...foundTerms, ...extractedLawNumbers])] // Eliminar duplicados
  }

  // Función para determinar el tipo de documento legal
  const identifyDocumentType = (content, terms) => {
    if (!content) return 'Documento general'
    
    if (terms.includes('contrato') || terms.includes('acuerdo')) {
      if (terms.includes('trabajo') || terms.includes('empleo')) return 'Contrato laboral'
      if (terms.includes('arrendamiento')) return 'Contrato de arrendamiento'
      if (terms.includes('compraventa')) return 'Contrato de compraventa'
      return 'Contrato general'
    }
    
    if (terms.includes('nacionalidad') || terms.includes('ciudadania')) {
      return 'Documento de nacionalidad/ciudadanía'
    }
    
    if (terms.includes('matrimonio') || terms.includes('divorcio')) {
      return 'Documento matrimonial'
    }
    
    if (terms.includes('sociedad') || terms.includes('empresa')) {
      return 'Documento empresarial'
    }
    
    return 'Documento legal general'
  }

  // Función para generar recomendaciones específicas por tipo de documento
  const getSpecificRecommendations = (documentType, laws) => {
    const recommendations = {
      'Contrato laboral': [
        '📋 Verificar que incluya todas las cláusulas obligatorias del Código del Trabajo',
        '💰 Confirmar que el salario cumple con el mínimo legal vigente',
        '⏰ Revisar jornada laboral y descansos según normativa',
        '🏥 Asegurar cobertura de seguridad social y riesgos laborales'
      ],
      'Contrato de arrendamiento': [
        '🏠 Verificar que cumple con la Ley de Arrendamientos',
        '💵 Confirmar que el reajuste de renta es legal',
        '📄 Revisar cláusulas de garantía y depósito',
        '🔧 Verificar responsabilidades de mantención'
      ],
      'Documento de nacionalidad/ciudadanía': [
        '🇨🇱 Verificar cumplimiento con Ley de Nacionalidad',
        '📅 Confirmar plazos de residencia requeridos',
        '📋 Revisar documentación de respaldo necesaria',
        '⚖️ Verificar antecedentes penales y requisitos'
      ],
      'Contrato de compraventa': [
        '🏡 Verificar títulos de propiedad y gravámenes',
        '💰 Confirmar forma de pago y garantías',
        '📋 Revisar obligaciones de cada parte',
        '🏛️ Verificar cumplimiento normativo municipal'
      ],
      'Documento empresarial': [
        '🏢 Verificar cumplimiento con Ley de Sociedades',
        '📊 Revisar aspectos tributarios y contables',
        '👥 Confirmar representación legal adecuada',
        '📋 Verificar inscripciones y permisos necesarios'
      ]
    }
    
    return recommendations[documentType] || [
      '📋 Revisar cumplimiento con normativa aplicable',
      '⚖️ Verificar que no contradiga leyes vigentes',
      '👨‍💼 Consultar con abogado especializado',
      '📱 Mantenerse actualizado con cambios legales'
    ]
  }

  // Función para buscar leyes basadas en términos del documento
  const searchLawsByDocumentContent = async (content) => {
    if (!content) return []
    
    const legalTerms = extractLegalTerms(content)
    if (legalTerms.length === 0) return []
    
    try {
      const query = legalTerms.slice(0, 6).join(' ')
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_LAWS_URL}/rest/v1/rpc/buscar_leyes`,
        {
          method: 'POST',
          headers: {
            'apikey': process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY,
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            termino_busqueda: query,
            limite_resultados: 5
          })
        }
      )
      if (!response.ok) return []
      const data = await response.json()
      return data || []
    } catch (error) {
      console.error('Error en búsqueda por contenido (RPC):', error)
      return []
    }
  }

  const searchLaws = async (query) => {
    try {
      // 1. Búsqueda en leyes generales (RPC buscar_leyes)
      const leyesPromise = fetch(
        `${process.env.REACT_APP_SUPABASE_LAWS_URL}/rest/v1/rpc/buscar_leyes`,
        {
          method: 'POST',
          headers: {
            'apikey': process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY,
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            termino_busqueda: query,
            limite_resultados: 5
          })
        }
      ).then(res => res.ok ? res.json() : []);

      // 2. Búsqueda en base de datos de códigos (RPC buscar_en_codigo_hibrido)
      // Esta es la nueva base de datos para códigos (penal, civil, etc.)
      const KONG_URL = process.env.REACT_APP_SUPABASE2_LAWS_CODE_URL;
      const KONG_KEY = process.env.REACT_APP_SUPABASE2_LAWS_ANON_URL;
      
      // Necesitamos generar un embedding para la consulta antes de llamar a la función híbrida
      // Usamos el servicio de embeddings existente
      const embedding = await groqService.getEmbedding(query);

      // Intentamos identificar si el usuario menciona un código específico
      let matchTitulo = '';
      const queryLower = query.toLowerCase();
      if (queryLower.includes('penal')) matchTitulo = 'CODIGO PENAL';
      else if (queryLower.includes('civil')) matchTitulo = 'CODIGO CIVIL';
      else if (queryLower.includes('trabajo') || queryLower.includes('laboral')) matchTitulo = 'CODIGO DEL TRABAJO';
      else if (queryLower.includes('comercio')) matchTitulo = 'CODIGO DE COMERCIO';
      else if (queryLower.includes('procesal penal')) matchTitulo = 'CODIGO PROCESAL PENAL';
      else if (queryLower.includes('tributario')) matchTitulo = 'CODIGO TRIBUTARIO';
      else if (queryLower.includes('sanitario')) matchTitulo = 'CODIGO SANITARIO';
      else if (queryLower.includes('aeronautico')) matchTitulo = 'CODIGO AERONAUTICO';
      
      // Si no detectamos un código específico, intentamos buscar en todos (o el más probable según contexto)
      // Por defecto, si no hay match, la función híbrida podría no devolver nada si match_titulo es obligatorio.
      
      let codigosPromise = Promise.resolve([]);

      if (matchTitulo && embedding && embedding.length > 0 && KONG_URL && KONG_KEY) {
        codigosPromise = fetch(
          `${KONG_URL}/rest/v1/rpc/buscar_en_codigo_hibrido`,
          {
            method: 'POST',
            headers: {
              'apikey': KONG_KEY, 
              'Authorization': `Bearer ${KONG_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              keyword_query: query,
              query_embedding: embedding,
              match_titulo: matchTitulo,
              match_count: 3
            })
          }
        ).then(res => res.ok ? res.json() : []).catch(err => {
          console.error('Error buscando en códigos:', err);
          return [];
        });
      }

      const [leyesResults, codigosResults] = await Promise.all([leyesPromise, codigosPromise]);
      
      // Combinar resultados, dando prioridad a los códigos si son muy relevantes
      const combinedResults = [...(codigosResults || []), ...(leyesResults || [])];
      
      // Eliminar duplicados si los hubiera (por ID)
      const uniqueResults = Array.from(new Map(combinedResults.map(item => [item.id, item])).values());
      
      return uniqueResults;

    } catch (error) {
      console.error('Error searching laws (RPC):', error)
    }
    return []
  }

  // Extraer contenido relevante según consulta del usuario
  const extractRelevantContent = (question, contenido) => {
    if (!contenido) return ''
    const normalize = (s) => s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
    const tokens = normalize(question)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !['que','dice','de','la','el','las','los','ley','norma','articulo','articulos','sobre'].includes(t))
    const paras = contenido.split(/\n\n+/)

    const scored = paras.map(p => {
      const np = normalize(p)
      const score = tokens.reduce((acc, tk) => acc + (np.includes(tk) ? 1 : 0), 0)
      // bonificar artículos y títulos
      const bonus = /titulo\s|articulo\s?\d+|articulo\s?[ivx]+/i.test(np) ? 1 : 0
      return { p, s: score + bonus }
    })
    scored.sort((a,b) => b.s - a.s)
    const best = scored.slice(0, 3).map(x => x.p.trim()).filter(Boolean)
    const joined = best.join('\n\n').substring(0, 1200)
    return joined || contenido.substring(0, 600)
  }

  const generateResponse = async (userMessage, fileContent = null) => {
    let relevantLaws = []
    let documentAnalysis = ''
    let legalTermsFound = []
    let documentType = 'Documento general'
    const lawNumberMatch = userMessage.match(/ley\s*(\d+)/i)
    
    // Si hay contenido de archivo, analizarlo primero
    if (fileContent && !fileContent.startsWith('Error al extraer')) {
      legalTermsFound = extractLegalTerms(fileContent)
      documentType = identifyDocumentType(fileContent, legalTermsFound)
      const lawsFromDocument = await searchLawsByDocumentContent(fileContent)
      relevantLaws = [...lawsFromDocument]
      
      // Análisis del documento con IA
      try {
        const analysisPrompt = `Eres un asistente legal especializado en derecho chileno. Analiza el siguiente documento de tipo "${documentType}" y proporciona:
1. Resumen de aspectos legales clave
2. Posibles riesgos o problemas de cumplimiento
3. Elementos que podrían necesitar actualización
4. Nivel de cumplimiento estimado (Alto/Medio/Bajo)

Documento:
${fileContent.substring(0, 2000)}`
        
        const analysisResponse = await groqService.groq.chat.completions.create({
          messages: [{
            role: 'user',
            content: analysisPrompt
          }],
          model: groqService.model,
          max_tokens: 600
        })
        
        documentAnalysis = analysisResponse.choices[0]?.message?.content || 'No se pudo generar análisis'
        
        // Registrar uso de tokens para análisis de documento
        if (analysisResponse.usage) {
          await trackTokenUsage(
            analysisResponse.usage.prompt_tokens || 0,
            analysisResponse.usage.completion_tokens || 0,
            'document_analysis'
          )
        }
      } catch (error) {
        console.error('Error en análisis IA:', error)
        documentAnalysis = 'Error al generar análisis con IA. Revisa manualmente el documento.'
      }
    }
    
    // Buscar leyes adicionales basadas en la consulta del usuario
    const queryLaws = await searchLaws(userMessage)
    relevantLaws = [...relevantLaws, ...queryLaws]
    
    // Eliminar duplicados
    const uniqueLaws = relevantLaws.filter((law, index, self) => 
      index === self.findIndex(l => l.id === law.id)
    )
    
    let response = `Consulta Legal: "${userMessage}"\n\n`
    
    if (fileContent && !fileContent.startsWith('Error al extraer')) {
      response += `**📄 Análisis del Documento Subido**\n`
      response += `**Tipo identificado:** ${documentType}\n\n`
      
      if (legalTermsFound.length > 0) {
        response += `**🏷️ Términos legales identificados:** ${legalTermsFound.join(', ')}\n\n`
      }
      
      if (documentAnalysis && !documentAnalysis.startsWith('Error al generar')) {
        response += `**🤖 Análisis Inteligente:**\n${documentAnalysis}\n\n`
      }
      
      // Estado de cumplimiento visual
      response += `**📊 Estado de Verificación:**\n`
      if (uniqueLaws.length > 0) {
        response += `✅ **Leyes aplicables encontradas:** ${uniqueLaws.length}\n`
        response += `🔍 **Recomendación:** Revisar cumplimiento con cada ley identificada\n`
        
        // Determinar nivel de riesgo basado en cantidad de leyes
        if (uniqueLaws.length >= 3) {
          response += `⚠️ **Nivel de complejidad:** Alto - Requiere revisión detallada\n\n`
        } else if (uniqueLaws.length >= 1) {
          response += `📋 **Nivel de complejidad:** Medio - Verificación estándar requerida\n\n`
        }
      } else {
        response += `⚠️ **Sin leyes específicas encontradas** - Considera consulta especializada\n\n`
      }
    }
    
    if (uniqueLaws.length > 0) {
      // fijar contexto si hay número de ley en la consulta
      if (lawNumberMatch) {
        setCurrentLaw(uniqueLaws[0])
      }
      response += `Leyes encontradas:\n\n`
      uniqueLaws.slice(0, 3).forEach((law, index) => {
        const titulo = law['Título de la Norma'] || 'Título no disponible'
        const numero = law['Número'] || law['Norma Número'] || 'No disponible'
        const fechaPub = law['Fecha de Publicación'] || law['Fecha'] || 'No especificada'
        const tipo = law['Tipo de Norma'] || 'No especificado'
        const url = law['Url'] || null
        const fragmento = extractRelevantContent(userMessage, law.Contenido || '')
        response += `${index + 1}. ${titulo}\n`
        response += `Número: ${numero}\n`
        response += `Publicación: ${fechaPub}\n`
        response += `Tipo: ${tipo}\n`
        if (fragmento) {
          response += `Fragmento relevante:\n${fragmento}\n\n`
        }
        const full = (law.Contenido || '').trim()
        if (full) {
          response += `Contenido completo:\n${full}\n\n`
        }
        if (url) {
          response += `Fuente oficial: ${url}\n\n`
        }
      })
    } else if (!fileContent && currentLaw) {
      // usar contexto previo si existe y la consulta es de seguimiento
      const titulo = currentLaw['Título de la Norma'] || 'Título no disponible'
      const numero = currentLaw['Número'] || currentLaw['Norma Número'] || 'No disponible'
      const fechaPub = currentLaw['Fecha de Publicación'] || currentLaw['Fecha'] || 'No especificada'
      const url = currentLaw['Url'] || null
      response += `Ley seleccionada como contexto: ${titulo} (Ley ${numero})\n`
      response += `Publicación: ${fechaPub}\n`
      if (url) {
        response += `Fuente oficial: ${url}\n\n`
      }
      const full = (currentLaw.Contenido || '').trim()
      if (full) {
        response += `Contenido completo:\n${full}\n`
      }
    }
    
    // Recomendaciones específicas por tipo de documento
    if (fileContent && !fileContent.startsWith('Error al extraer')) {
      const specificRecommendations = getSpecificRecommendations(documentType, uniqueLaws)
      response += `**🎯 Recomendaciones Específicas para ${documentType}:**\n`
      specificRecommendations.forEach(rec => {
        response += `${rec}\n`
      })
      response += `\n`
    }
    
    // Se elimina bloque de próximos pasos con símbolos para evitar ruido visual
    
    if (uniqueLaws.length === 0 && !fileContent && !currentLaw) {
      response = `No se encontraron leyes específicas para: "${userMessage}"\n\n`
      response += `Sugerencias:\n`
      response += `- Usa términos legales más específicos\n`
      response += `- Indica número de ley cuando lo conozcas\n`
      response += `- Revisa la fuente oficial si tienes dudas\n`
    }
    
    return { text: response, laws: uniqueLaws.slice(0, 3) }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !uploadedFile) return

    const userMessage = inputMessage.trim()
    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      file: uploadedFile ? { name: uploadedFile.name, size: uploadedFile.size } : null,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newUserMessage])
    setInputMessage('')
    setLoading(true)

    try {
      let fileContent = null
      if (uploadedFile) {
        try {
          fileContent = await fileExtractor.extractContent(uploadedFile)
          console.log('Contenido extraído:', fileContent.substring(0, 200) + '...')
        } catch (error) {
          console.error('Error extrayendo contenido:', error)
          fileContent = `Error al extraer contenido del archivo: ${error.message}`
        }
      }

      const aiResponse = await generateResponse(userMessage, fileContent)

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse.text,
        laws: aiResponse.laws,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])
      
      // Registrar la conversación en la base de datos
      try {
        await conversationService.registrarConversacion(
          user.email,
          'chat_legal',
          userMessage,
          aiResponse.text
        )
        console.log('✅ Conversación legal registrada exitosamente')
      } catch (error) {
        console.error('❌ Error al registrar conversación legal:', error)
        // No mostramos error al usuario para no interrumpir la experiencia
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor intenta nuevamente.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      setUploadedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full scroll-to-top-mobile">
      {/* Chat Header */}
      <div className="bg-blue-50 p-4 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600 mr-2" />
            <div>
              <h3 className="font-semibold text-blue-900">Asistente Legal IA</h3>
              <p className="text-sm text-blue-700">Sube documentos y haz consultas sobre leyes chilenas</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-600 font-medium">Tokens utilizados</div>
            <div className="text-sm font-bold text-blue-800">{tokensUsed.toLocaleString()}</div>
          </div>
        </div>
        {currentLaw && (
          <div className="mt-3 p-2 bg-blue-100 border border-blue-200 rounded flex items-center justify-between">
            <div className="text-xs text-blue-900">
              <span className="font-semibold">Contexto activo:</span> {currentLaw['Título de la Norma'] || 'Ley seleccionada'}
              { (currentLaw['Número'] || currentLaw['Norma Número']) && (
                <span> (Ley {currentLaw['Número'] || currentLaw['Norma Número']})</span>
              ) }
            </div>
            <button
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setCurrentLaw(null)}
            >
              Quitar contexto
            </button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>Inicia una conversación subiendo un documento o haciendo una pregunta legal</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl px-4 py-2 rounded-lg ${
              message.type === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-800 border border-gray-200'
            }`}>
              <div className="flex items-start">
                {message.type === 'ai' && (
                  <CpuChipIcon className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                )}
                {message.type === 'user' && (
                  <UserIcon className="h-5 w-5 text-blue-100 mr-2 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                  {message.file && (
                    <div className="mt-2 p-2 bg-blue-500 rounded text-xs">
                      <PaperClipIcon className="h-3 w-3 inline mr-1" />
                      {message.file.name} ({Math.round(message.file.size / 1024)} KB)
                    </div>
                  )}
                  {message.type === 'ai' && message.laws && message.laws.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.laws.map((law, idx) => (
                        <div key={idx} className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="text-xs text-blue-900">
                            <span className="font-medium">{law['Título de la Norma'] || 'Título no disponible'}</span>
                            { (law['Número'] || law['Norma Número']) && (
                              <span> — Ley {law['Número'] || law['Norma Número']}</span>
                            )}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              onClick={() => setCurrentLaw(law)}
                            >
                              Utilizar como contexto
                            </button>
                            <a
                              className="text-xs px-2 py-1 bg-white text-blue-700 border border-blue-300 rounded hover:bg-blue-100"
                              href={law['Url'] || '#'}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver fuente
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 border border-gray-200 max-w-3xl px-4 py-2 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm">Analizando...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        {/* File Upload */}
        {uploadedFile && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <PaperClipIcon className="h-4 w-4 text-blue-600 mr-2" />
              <span className="text-sm text-blue-800">
                {uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)
              </span>
            </div>
            <button onClick={removeFile} className="text-blue-600 hover:text-blue-800">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        
        <div className="flex items-end space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx"
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Subir documento"
          >
            <DocumentArrowUpIcon className="h-5 w-5" />
          </button>
          
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu consulta legal aquí..."
              className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={loading || (!inputMessage.trim() && !uploadedFile)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatLegal
