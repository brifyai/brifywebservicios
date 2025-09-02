import Groq from 'groq-sdk'
import embeddingsService from '../lib/embeddings'

class GroqService {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.REACT_APP_GROQ_API_KEY,
      dangerouslyAllowBrowser: true // Permitir uso en el navegador
    })
    this.model = 'gemma2-9b-it'
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
   * Genera una respuesta de chat usando GROQ GEMMA 2-9b-it
   * @param {string} userMessage - Mensaje del usuario
   * @param {Array} context - Contexto de documentos encontrados
   * @param {Array} chatHistory - Historial de conversación
   * @param {string} userId - ID del usuario para tracking de tokens
   * @returns {Promise<Object>} - Respuesta del modelo y tokens utilizados
   */
  async generateChatResponse(userMessage, context = [], chatHistory = [], userId = null) {
    try {
      // Construir el contexto de documentos
      let contextText = ''
      if (context && context.length > 0) {
        contextText = '\n\nCONTEXTO DE DOCUMENTOS:\n'
        context.forEach((doc, index) => {
          contextText += `\n[Documento ${index + 1}]: ${doc.content}\n`
        })
      }

      // Construir mensajes para el chat
      const messages = [
        {
          role: 'system',
          content: `Eres un asistente IA especializado en analizar y responder preguntas sobre documentos. 

Instrucciones:
- Responde en español de manera clara y concisa
- Usa la información del contexto proporcionado cuando sea relevante
- Si no tienes información suficiente en el contexto, indícalo claramente
- Sé útil y preciso en tus respuestas
- Mantén un tono profesional pero amigable${contextText}`
        }
      ]

      // Agregar historial de chat
      if (chatHistory && chatHistory.length > 0) {
        chatHistory.forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content
          })
        })
      }

      // Agregar mensaje actual del usuario
      messages.push({
        role: 'user',
        content: userMessage
      })

      const completion = await this.groq.chat.completions.create({
        messages: messages,
        model: this.model,
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 1,
        stream: false
      })

      const response = completion.choices[0]?.message?.content || 'No se pudo generar una respuesta'
      
      // Calcular tokens utilizados
      const inputTokens = this.estimateTokens(JSON.stringify(messages))
      const outputTokens = this.estimateTokens(response)
      const totalTokens = inputTokens + outputTokens

      // Registrar uso de tokens si se proporciona userId
      if (userId) {
        await this.trackTokenUsage(userId, totalTokens, 'groq_chat')
      }

      return {
        response,
        tokensUsed: totalTokens
      }
    } catch (error) {
      console.error('Error generating chat response:', error)
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