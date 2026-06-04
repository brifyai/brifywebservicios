import embeddingsService from '../lib/embeddings'

class MinimaxService {
  constructor() {
    this.apiKey = process.env.REACT_APP_MINIMAX_API_KEY
    this.endpoint = process.env.REACT_APP_MINIMAX_ENDPOINT || 'https://api.minimax.io/anthropic/v1/messages'
    this.model = process.env.REACT_APP_MINIMAX_MODEL || 'MiniMax-M2.7'
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4)
  }

  truncateText(text, maxTokens) {
    const maxChars = maxTokens * 4
    if (!text || text.length <= maxChars) return text
    return text.substring(0, maxChars) + '...'
  }

  optimizeContext(context, maxTokens = 3000) {
    if (!context || context.length === 0) {
      return ''
    }

    let contextText = '\n\nContexto de documentos:\n'
    let currentTokens = this.estimateTokens(contextText)

    for (let i = 0; i < context.length; i++) {
      const doc = context[i]
      const docText = `\n--- Documento ${i + 1} ---\n${doc.content}\n`
      const docTokens = this.estimateTokens(docText)

      if (currentTokens + docTokens > maxTokens) {
        break
      }

      contextText += docText
      currentTokens += docTokens
    }

    return contextText
  }

  optimizeChatHistory(chatHistory, maxTokens = 1500) {
    if (!chatHistory || chatHistory.length === 0) {
      return []
    }

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

  async trackTokenUsage(userId, tokensUsed, operation = 'minimax_chat') {
    try {
      await embeddingsService.trackTokenUsage(userId, tokensUsed, operation)
    } catch (error) {
      console.error('Error tracking token usage:', error)
    }
  }

  fireAndForget(promise) {
    Promise.resolve(promise).catch((error) => {
      console.error('Background task error:', error)
    })
  }

  async createMessage({ system, messages, max_tokens, temperature, top_p }) {
    if (!this.apiKey) {
      throw new Error('REACT_APP_MINIMAX_API_KEY no está configurada')
    }

    const payload = {
      model: this.model,
      max_tokens,
      messages
    }

    if (typeof system === 'string' && system.trim()) {
      payload.system = system
    }
    if (typeof temperature === 'number') {
      payload.temperature = temperature
    }
    if (typeof top_p === 'number') {
      payload.top_p = top_p
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `HTTP ${response.status}`
      throw new Error(`Error en Minimax API: ${message}`)
    }

    const content = data?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('')
    }
    if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content
    return 'No se pudo generar una respuesta'
  }

  async generateChatResponse(userMessage, context = [], chatHistory = [], userId = null) {
    try {
      const MAX_CONTEXT_TOKENS = 3000
      const MAX_HISTORY_TOKENS = 2000
      const MAX_SYSTEM_TOKENS = 500

      const contextText = this.optimizeContext(context, MAX_CONTEXT_TOKENS)
      const optimizedHistory = this.optimizeChatHistory(chatHistory, MAX_HISTORY_TOKENS)

      const systemText = this.truncateText(
        `Eres un asistente IA especializado en analizar y responder preguntas sobre documentos.

Instrucciones:
- Responde en español de manera clara y concisa
- Usa la información del contexto proporcionado cuando sea relevante
- Si no tienes información suficiente en el contexto, indícalo claramente
- Sé útil y preciso en tus respuestas
- Mantén un tono profesional pero amigable${contextText}`,
        MAX_SYSTEM_TOKENS
      )

      const messages = []

      optimizedHistory.forEach((msg) => {
        if (msg.role === 'system') return
        if (msg.role !== 'user' && msg.role !== 'assistant') return
        messages.push({ role: msg.role, content: msg.content })
      })

      messages.push({
        role: 'user',
        content: this.truncateText(userMessage, 500)
      })

      const responseText = await this.createMessage({
        system: systemText,
        messages,
        temperature: 0.7,
        max_tokens: 800,
        top_p: 1
      })

      const inputTokens = this.estimateTokens(JSON.stringify({ system: systemText, messages }))
      const outputTokens = this.estimateTokens(responseText)
      const totalTokens = inputTokens + outputTokens

      if (userId) {
        this.fireAndForget(this.trackTokenUsage(userId, totalTokens, 'minimax_chat'))
      }

      return {
        response: responseText,
        tokensUsed: totalTokens,
        contextUsed: context.length,
        historyUsed: optimizedHistory.length
      }
    } catch (error) {
      console.error('Error generating chat response (Minimax):', error)
      throw error
    }
  }

  async summarizeDocuments(documents, userId = null) {
    try {
      if (!documents || documents.length === 0) {
        return { summary: 'No hay documentos para resumir', tokensUsed: 0 }
      }

      let content = 'DOCUMENTOS A RESUMIR:\n\n'
      documents.forEach((doc, index) => {
        content += `Documento ${index + 1}:\n${doc.content}\n\n`
      })

      const system = 'Eres un experto en crear resúmenes concisos y útiles. Genera un resumen claro y estructurado de los documentos proporcionados en español.'
      const messages = [{ role: 'user', content }]

      const summary = await this.createMessage({
        system,
        messages,
        temperature: 0.5,
        max_tokens: 512,
        top_p: 1
      })

      const inputTokens = this.estimateTokens(JSON.stringify({ system, messages }))
      const outputTokens = this.estimateTokens(summary)
      const totalTokens = inputTokens + outputTokens

      if (userId) {
        this.fireAndForget(this.trackTokenUsage(userId, totalTokens, 'minimax_summary'))
      }

      return { summary, tokensUsed: totalTokens }
    } catch (error) {
      console.error('Error summarizing documents (Minimax):', error)
      throw error
    }
  }

  async isAvailable() {
    try {
      const text = await this.createMessage({
        system: '',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      })
      return !!text
    } catch (error) {
      console.error('Minimax service not available:', error)
      return false
    }
  }
}

export default new MinimaxService()
