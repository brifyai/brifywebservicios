import embeddingsService from '../lib/embeddings'

class EmbeddingService {
  preprocessText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .trim()
  }

  async processFile(file, fileContentExtractor, userId = null) {
    try {
      const content = await fileContentExtractor.extractContent(file)

      if (!content || content.trim().length === 0) {
        throw new Error('No se pudo extraer contenido del archivo, estructura no compatible')
      }

      const cleanContent = this.preprocessText(content)
      const embeddingResult = await embeddingsService.generateEmbedding(cleanContent, userId)

      return {
        content: cleanContent,
        embedding: embeddingResult.embedding
      }
    } catch (error) {
      console.error('Error processing file:', error)
      throw error
    }
  }
}

export default new EmbeddingService()
