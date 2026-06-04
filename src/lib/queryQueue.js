// Sistema de cola global para consultas a Supabase
// Evita el error ERR_INSUFFICIENT_RESOURCES limitando consultas concurrentes

class QueryQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent
    this.running = 0
    this.queue = []
  }

  async add(queryFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        queryFunction,
        resolve,
        reject
      })
      this.process()
    })
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    this.running++
    const { queryFunction, resolve, reject } = this.queue.shift()

    try {
      const result = await queryFunction()
      resolve(result)
    } catch (error) {
      reject(error)
    } finally {
      this.running--
      // Procesar siguiente en la cola después de un pequeño delay
      setTimeout(() => this.process(), 100)
    }
  }
}

// Instancia global de la cola
const globalQueryQueue = new QueryQueue(2)

// Función helper para ejecutar consultas con reintentos
export const executeQuery = async (queryFunction, maxRetries = 3) => {
  return globalQueryQueue.add(async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await queryFunction()
        if (result.error) throw result.error
        return result
      } catch (error) {
        console.warn(`Intento ${attempt}/${maxRetries} falló:`, error.message)
        if (attempt === maxRetries) throw error
        // Espera progresiva: 500ms, 1s, 1.5s
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
      }
    }
  })
}

export default globalQueryQueue