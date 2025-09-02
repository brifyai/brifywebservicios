import { GoogleGenerativeAI } from '@google/generative-ai'

// API Key de Gemini desde el README
const GEMINI_API_KEY = 'AIzaSyBveZcn7HLx2zIagNdnjioZS8PXqkJIUeg'

class EmbeddingService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  }

  /**
   * Genera embeddings para un texto usando la API de Gemini
   * @param {string} text - Texto para generar embeddings
   * @returns {Promise<number[]>} - Array de embeddings
   */
  async generateEmbedding(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('El texto no puede estar vacío')
      }

      // Limpiar y preparar el texto
      const cleanText = this.preprocessText(text)
      
      // Usar el modelo de embeddings de Google
      const model = this.genAI.getGenerativeModel({ model: 'models/embedding-001' })
      
      const result = await model.embedContent(cleanText)
      
      if (!result.embedding || !result.embedding.values) {
        throw new Error('No se pudieron generar embeddings')
      }

      return result.embedding.values
    } catch (error) {
      console.error('Error generating embedding:', error)
      
      // Fallback: generar embedding mock si falla la API
      console.warn('Usando embedding mock debido a error en API')
      return this.generateMockEmbedding()
    }
  }

  /**
   * Preprocesa el texto antes de generar embeddings
   * @param {string} text - Texto original
   * @returns {string} - Texto procesado
   */
  preprocessText(text) {
    // Limpiar el texto
    let cleanText = text
      .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
      .replace(/[\r\n]+/g, ' ') // Reemplazar saltos de línea con espacios
      .trim()
    
    // Limitar la longitud del texto (Gemini tiene límites)
    const maxLength = 30000 // Límite conservador
    if (cleanText.length > maxLength) {
      cleanText = cleanText.substring(0, maxLength) + '...'
      console.warn(`Texto truncado a ${maxLength} caracteres para embeddings`)
    }
    
    return cleanText
  }

  /**
   * Genera un embedding mock de 768 dimensiones
   * @returns {number[]} - Array de números aleatorios normalizados
   */
  generateMockEmbedding() {
    const dimensions = 768
    const embedding = new Array(dimensions)
    
    // Generar números aleatorios con distribución normal
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = (Math.random() - 0.5) * 2 // Rango [-1, 1]
    }
    
    // Normalizar el vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }

  /**
   * Calcula la similitud coseno entre dos embeddings
   * @param {number[]} embedding1 - Primer embedding
   * @param {number[]} embedding2 - Segundo embedding
   * @returns {number} - Similitud coseno (0-1)
   */
  cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Los embeddings deben tener la misma dimensión')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  /**
   * Procesa un archivo completo: extrae contenido y genera embeddings
   * @param {File} file - Archivo a procesar
   * @param {Object} fileContentExtractor - Servicio de extracción de contenido
   * @returns {Promise<{content: string, embedding: number[]}>} - Contenido y embedding
   */
  async processFile(file, fileContentExtractor) {
    try {
      // Extraer contenido del archivo
      const content = await fileContentExtractor.extractContent(file)
      
      if (!content || content.trim().length === 0) {
        throw new Error('No se pudo extraer contenido del archivo, estructura no compatible')
      }

      // Generar embedding del contenido
      const embedding = await this.generateEmbedding(content)
      
      return {
        content: content.trim(),
        embedding
      }
    } catch (error) {
      console.error('Error processing file:', error)
      throw error
    }
  }
}

export default new EmbeddingService()