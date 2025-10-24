import Groq from 'groq-sdk'
import embeddingsService from '../lib/embeddings'

class GroqService {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.REACT_APP_GROQ_API_KEY,
      dangerouslyAllowBrowser: true // Permitir uso en el navegador
    })
    this.model = 'llama-3.1-8b-instant'
  }

  /**
   * Estima el número de tokens en un texto
   * @param {string} text - Texto a analizar
   * @returns {number} - Número estimado de tokens
   */
  estimateTokens(text) {
    // Estimación aproximada: 1 token ≈ 4 caracteres para español
    return Math.ceil(text.length / 4)
  }

  /**
   * Registra el uso de tokens usando el servicio de embeddings
   * @param {string} userId - ID del usuario
   * @param {number} tokensUsed - Tokens utilizados
   * @param {string} operation - Tipo de operación
   */
  async trackTokenUsage(userId, tokensUsed, operation = 'groq_chat') {
    try {
      // Usar el método del embeddingsService para evitar duplicación
      await embeddingsService.trackTokenUsage(userId, tokensUsed, operation);
    } catch (error) {
      console.error('Error tracking token usage:', error)
    }
  }

  /**
   * Trunca texto para mantenerlo dentro del límite de tokens
   * @param {string} text - Texto a truncar
   * @param {number} maxTokens - Máximo número de tokens permitidos
   * @returns {string} - Texto truncado
   */
  truncateText(text, maxTokens) {
    const estimatedTokens = this.estimateTokens(text)
    if (estimatedTokens <= maxTokens) {
      return text
    }
    
    // Calcular caracteres aproximados para el límite de tokens
    const maxChars = maxTokens * 4
    const truncated = text.substring(0, maxChars)
    
    // Intentar cortar en una palabra completa
    const lastSpaceIndex = truncated.lastIndexOf(' ')
    if (lastSpaceIndex > maxChars * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + '...'
    }
    
    return truncated + '...'
  }

  /**
   * Optimiza el contexto de documentos para evitar exceder límites
   * @param {Array} context - Contexto original
   * @param {number} maxTokens - Máximo tokens para contexto
   * @returns {string} - Contexto optimizado
   */
  optimizeContext(context, maxTokens = 2000) {
    if (!context || context.length === 0) {
      return ''
    }

    let contextText = '\n\nCONTEXTO DE DOCUMENTOS:\n'
    let currentTokens = this.estimateTokens(contextText)
    
    for (let i = 0; i < context.length; i++) {
      const doc = context[i]
      const docText = `\n[Documento ${i + 1}]: ${doc.content}\n`
      const docTokens = this.estimateTokens(docText)
      
      if (currentTokens + docTokens > maxTokens) {
        // Si es el primer documento y es muy largo, truncarlo
        if (i === 0) {
          const remainingTokens = maxTokens - currentTokens - 50 // Buffer
          const truncatedContent = this.truncateText(doc.content, remainingTokens)
          contextText += `\n[Documento ${i + 1}]: ${truncatedContent}\n`
        }
        break
      }
      
      contextText += docText
      currentTokens += docTokens
    }
    
    return contextText
  }

  /**
   * Optimiza el historial de chat para evitar exceder límites
   * @param {Array} chatHistory - Historial original
   * @param {number} maxTokens - Máximo tokens para historial
   * @returns {Array} - Historial optimizado
   */
  optimizeChatHistory(chatHistory, maxTokens = 1500) {
    if (!chatHistory || chatHistory.length === 0) {
      return []
    }

    // Empezar desde los mensajes más recientes
    const optimizedHistory = []
    let currentTokens = 0
    
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const message = chatHistory[i]
      const messageTokens = this.estimateTokens(JSON.stringify(message))
      
      if (currentTokens + messageTokens > maxTokens) {
        break
      }
      
      optimizedHistory.unshift(message)
      currentTokens += messageTokens
    }
    
    return optimizedHistory
  }

  /**
   * Genera una respuesta de chat usando GROQ Llama 3.1 8B Instant con optimización de contexto
   * @param {string} userMessage - Mensaje del usuario
   * @param {Array} context - Contexto de documentos encontrados
   * @param {Array} chatHistory - Historial de conversación
   * @param {string} userId - ID del usuario para tracking de tokens
   * @returns {Promise<Object>} - Respuesta del modelo y tokens utilizados
   */
  async generateChatResponse(userMessage, context = [], chatHistory = [], userId = null) {
    try {
      // Límites de tokens para evitar exceder el contexto
      const MAX_TOTAL_INPUT_TOKENS = 8000 // Límite aumentado para llama-3.1-8b-instant
      const MAX_CONTEXT_TOKENS = 3000
      const MAX_HISTORY_TOKENS = 2000
      const MAX_SYSTEM_TOKENS = 500
      
      // Optimizar contexto de documentos
      const contextText = this.optimizeContext(context, MAX_CONTEXT_TOKENS)
      
      // Optimizar historial de chat
      const optimizedHistory = this.optimizeChatHistory(chatHistory, MAX_HISTORY_TOKENS)
      
      // Mensaje del sistema optimizado
      const systemMessage = {
        role: 'system',
        content: this.truncateText(
          `Eres un asistente IA especializado en analizar y responder preguntas sobre documentos. 

Instrucciones:
- Responde en español de manera clara y concisa
- Usa la información del contexto proporcionado cuando sea relevante
- Si no tienes información suficiente en el contexto, indícalo claramente
- Sé útil y preciso en tus respuestas
- Mantén un tono profesional pero amigable${contextText}`,
          MAX_SYSTEM_TOKENS
        )
      }

      // Construir mensajes para el chat
      const messages = [systemMessage]

      // Agregar historial optimizado
      optimizedHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        })
      })

      // Agregar mensaje actual del usuario (truncar si es muy largo)
      messages.push({
        role: 'user',
        content: this.truncateText(userMessage, 500)
      })

      // Verificar tokens totales antes de enviar
      const totalInputTokens = this.estimateTokens(JSON.stringify(messages))
      console.log(`📊 Tokens de entrada estimados: ${totalInputTokens}/${MAX_TOTAL_INPUT_TOKENS}`)
      
      if (totalInputTokens > MAX_TOTAL_INPUT_TOKENS) {
        console.warn('⚠️ Tokens de entrada exceden el límite, reduciendo contexto...')
        // Reducir aún más el contexto si es necesario
        const reducedContext = this.optimizeContext(context, MAX_CONTEXT_TOKENS * 0.5)
        messages[0].content = this.truncateText(
          `Eres un asistente IA especializado en analizar y responder preguntas sobre documentos. 

Instrucciones:
- Responde en español de manera clara y concisa
- Usa la información del contexto proporcionado cuando sea relevante
- Si no tienes información suficiente en el contexto, indícalo claramente
- Sé útil y preciso en tus respuestas
- Mantén un tono profesional pero amigable${reducedContext}`,
          MAX_SYSTEM_TOKENS * 0.7
        )
      }

      const completion = await this.groq.chat.completions.create({
        messages: messages,
        model: this.model,
        temperature: 0.7,
        max_tokens: 800, // Reducido para dejar más espacio al input
        top_p: 1,
        stream: false
      })

      const response = completion.choices[0]?.message?.content || 'No se pudo generar una respuesta'
      
      // Calcular tokens utilizados
      const inputTokens = this.estimateTokens(JSON.stringify(messages))
      const outputTokens = this.estimateTokens(response)
      const totalTokens = inputTokens + outputTokens

      console.log(`✅ Respuesta generada - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens} tokens`)

      // Registrar uso de tokens si se proporciona userId
      if (userId) {
        await this.trackTokenUsage(userId, totalTokens, 'groq_chat')
      }

      return {
        response,
        tokensUsed: totalTokens,
        contextUsed: context.length,
        historyUsed: optimizedHistory.length
      }
    } catch (error) {
      console.error('Error generating chat response:', error)
      
      // Proporcionar información más específica sobre el error
      if (error.message && error.message.includes('context_length_exceeded')) {
        throw new Error('El contexto de la conversación es demasiado largo. Por favor, inicia una nueva conversación o reduce el tamaño de tu mensaje.')
      }
      
      throw new Error(`Error en GROQ API: ${error.message}`)
    }
  }

  /**
   * Genera un resumen de documentos
   * @param {Array} documents - Documentos a resumir
   * @param {string} userId - ID del usuario para tracking de tokens
   * @returns {Promise<Object>} - Resumen generado y tokens utilizados
   */
  async summarizeDocuments(documents, userId = null) {
    try {
      if (!documents || documents.length === 0) {
        return 'No hay documentos para resumir'
      }

      let content = 'DOCUMENTOS A RESUMIR:\n\n'
      documents.forEach((doc, index) => {
        content += `Documento ${index + 1}:\n${doc.content}\n\n`
      })

      const messages = [
        {
          role: 'system',
          content: 'Eres un experto en crear resúmenes concisos y útiles. Genera un resumen claro y estructurado de los documentos proporcionados en español.'
        },
        {
          role: 'user',
          content: content
        }
      ]

      const completion = await this.groq.chat.completions.create({
        messages: messages,
        model: this.model,
        temperature: 0.5,
        max_tokens: 512,
        top_p: 1,
        stream: false
      })

      const summary = completion.choices[0]?.message?.content || 'No se pudo generar el resumen'
      
      // Calcular tokens utilizados
      const inputTokens = this.estimateTokens(JSON.stringify(messages))
      const outputTokens = this.estimateTokens(summary)
      const totalTokens = inputTokens + outputTokens

      // Registrar uso de tokens si se proporciona userId
      if (userId) {
        await this.trackTokenUsage(userId, totalTokens, 'groq_summary')
      }

      return {
        summary,
        tokensUsed: totalTokens
      }
    } catch (error) {
      console.error('Error summarizing documents:', error)
      throw new Error(`Error generando resumen: ${error.message}`)
    }
  }

  /**
   * Verifica si el servicio está disponible
   * @returns {Promise<boolean>} - True si está disponible
   */
  async isAvailable() {
    try {
      const testCompletion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: 'test' }],
        model: this.model,
        max_tokens: 5
      })
      return !!testCompletion.choices[0]?.message?.content
    } catch (error) {
      console.error('GROQ service not available:', error)
      return false
    }
  }
}

export default new GroqService()