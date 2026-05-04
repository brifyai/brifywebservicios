// Servicio de embeddings y tracking de tokens
import { supabase } from './supabase';

class EmbeddingsService {
  constructor() {
    // Cache para evitar consultas excesivas
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 segundos
  }

  // Generar embeddings para texto
  async generateEmbedding(text, userId) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('El texto no puede estar vacío')
      }

      const embedding = this.generateDeterministicEmbedding(text)
      const tokensUsed = Math.ceil(text.length / 4)

      await this.trackTokenUsage(userId, tokensUsed, 'embedding')

      return { embedding, tokens_used: tokensUsed }
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  normalizeForEmbedding(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  hashStringToUint32(str) {
    let hash = 2166136261
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
  }

  generateDeterministicEmbedding(text, dimensions = 768) {
    const normalized = this.normalizeForEmbedding(text)
    const tokens = normalized.split(' ').filter(t => t.length > 0)

    const vector = new Array(dimensions).fill(0)

    for (const token of tokens) {
      const hash = this.hashStringToUint32(token)
      const index = hash % dimensions
      const sign = (hash & 1) === 0 ? 1 : -1
      const magnitude = 1 + ((hash >>> 1) % 3)
      vector[index] += sign * magnitude
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
    return vector.map(v => v / norm)
  }

  // Procesar archivo para embeddings (DEPRECATED - ahora se maneja en Files.js)
  // Esta función se mantiene por compatibilidad pero ya no se usa
  async processFileForEmbeddings(fileId, content, userId) {
    console.warn('⚠️ processFileForEmbeddings está deprecated. Los chunks ahora se crean directamente en documentos_entrenador desde Files.js');
    
    try {
      // Dividir contenido en chunks si es muy largo
      const chunks = this.splitTextIntoChunks(content, 8000);
      
      return {
        chunks_processed: chunks.length,
        total_tokens: 0 // Los tokens se manejan individualmente en Files.js
      };
    } catch (error) {
      console.error('Error processing file for embeddings:', error);
      throw error;
    }
  }

  // Dividir texto en chunks
  splitTextIntoChunks(text, maxLength = 8000) {
    const chunks = [];
    let currentChunk = '';
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          // Si una sola oración es muy larga, dividirla por palabras
          const words = sentence.split(' ');
          let wordChunk = '';
          for (const word of words) {
            if ((wordChunk + ' ' + word).length > maxLength) {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
                wordChunk = word;
              } else {
                chunks.push(word);
              }
            } else {
              wordChunk += (wordChunk ? ' ' : '') + word;
            }
          }
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        }
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  // Buscar contenido similar en documentos_administrador
  async searchSimilarContent(query, administradorEmail, limit = 10, servicio = 'abogados') {
    try {
      const normalizedQuery = this.normalizeForEmbedding(query)
      const terms = normalizedQuery
        .split(' ')
        .filter(t => t.length > 2)
        .slice(0, 10)

      let dbQuery = supabase
        .from('documentos_administrador')
        .select('id,name,file_type,file_id,created_at,metadata,content')
        .eq('administrador', administradorEmail)

      if (servicio) {
        dbQuery = dbQuery.eq('servicio', servicio)
      }

      if (terms.length > 0) {
        const orConditions = terms
          .flatMap(t => [`content.ilike.%${t}%`, `name.ilike.%${t}%`])
          .join(',')
        dbQuery = dbQuery.or(orConditions)
      } else if (query && query.trim()) {
        dbQuery = dbQuery.ilike('content', `%${query.trim()}%`)
      }

      const fetchLimit = Math.max(limit * 3, limit)
      const { data: documents, error: searchError } = await dbQuery
        .order('created_at', { ascending: false })
        .limit(fetchLimit)

      if (searchError) {
        console.error('Error searching documents:', searchError)
        throw searchError
      }

      const results = (documents || []).map((doc) => {
        const metadata = doc.metadata || {}
        const isChunk = metadata.chunk_type === 'chunk'
        const haystack = `${doc.name || ''}\n${doc.content || ''}`.toLowerCase()
        const score = terms.length
          ? terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0)
          : 0
        const similarity = terms.length ? score / terms.length : 0.5

        return {
          content: doc.content,
          file_name: metadata.name || doc.name || 'Documento sin nombre',
          similarity,
          source: isChunk ? 'chunk' : 'main_document',
          file_id: metadata.file_id || doc.file_id,
          chunk_index: metadata.chunk_index || null,
          chunk_info: isChunk ? metadata.chunk_of_total : null,
          parent_file_id: metadata.parent_file_id || null,
          upload_date: metadata.upload_date || doc.created_at,
          file_type: metadata.file_type || doc.file_type
        }
      })

      results.sort((a, b) => b.similarity - a.similarity)
      return results.slice(0, limit)
    } catch (error) {
      console.error('Error searching similar content:', error);
      throw error;
    }
  }

  // Registrar uso de tokens
  async trackTokenUsage(userId, tokensUsed, operation) {
    try {
      // Primero verificamos si ya existe un registro para este usuario
      const { data: existingRecord, error: fetchError } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used, total_tokens')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingRecord) {
        // Si existe, actualizamos el contador sumando los nuevos tokens
        const { error } = await supabase
          .from('user_tokens_usage')
          .update({
            tokens_used: existingRecord.tokens_used + tokensUsed,
            operation: operation,
            last_updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (error) {
          throw error;
        }
      } else {
        // Si no existe, insertamos un nuevo registro con límite del plan
        // Obtener límite del plan del usuario
        const { data: userData } = await supabase
          .from('users')
          .select('current_plan_id')
          .eq('id', userId)
          .maybeSingle();
        
        let totalTokens = 1000; // valor por defecto
        if (userData?.current_plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('token_limit_usage')
            .eq('id', userData.current_plan_id)
            .maybeSingle();
          totalTokens = planData?.token_limit_usage || 1000;
        }

        const { error } = await supabase
          .from('user_tokens_usage')
          .insert({
            user_id: userId,
            tokens_used: tokensUsed,
            total_tokens: totalTokens,
            operation: operation,
            created_at: new Date().toISOString(),
            last_updated_at: new Date().toISOString()
          });

        if (error) {
          throw error;
        }
      }

      // ELIMINADO: No llamar a updateUserTokenCount para evitar duplicación
      console.log(`Token usage tracked: ${tokensUsed} tokens for operation: ${operation}`);
    } catch (error) {
      console.error('Error tracking token usage:', error);
    }
  }

  // Actualizar contador total de tokens del usuario
  async updateUserTokenCount(userId, tokensUsed) {
    try {
      const { data: tokenUsage, error: fetchError } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used, total_tokens')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (tokenUsage) {
        // Actualizar registro existente - solo incrementar tokens_used
        const newTokensUsed = (tokenUsage.tokens_used || 0) + tokensUsed;
        const { error: updateError } = await supabase
          .from('user_tokens_usage')
          .update({ 
            tokens_used: newTokensUsed,
            last_updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Crear nuevo registro - inicializar con tokens_used y total_tokens por defecto
        const { error: insertError } = await supabase
          .from('user_tokens_usage')
          .insert({
            user_id: userId,
            tokens_used: tokensUsed,
            total_tokens: 1000, // tokens por defecto del plan gratuito
            last_updated_at: new Date().toISOString()
          });

        if (insertError) {
          throw insertError;
        }
      }
    } catch (error) {
      console.error('Error updating user token count:', error);
    }
  }

  // Obtener estadísticas de uso de tokens con cache
  async getTokenUsageStats(userId, period = '30 days') {
    const cacheKey = `token_stats_${userId}`;
    const cached = this.cache.get(cacheKey);
    
    // Verificar cache
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    
    try {
      // Obtener el total de tokens usados con maybeSingle para evitar errores
      const { data: totalData, error: totalError } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (totalError) {
        console.warn('Error getting total tokens used:', totalError);
      }

      const totalTokensUsed = totalData?.tokens_used || 0;

      // Obtener solo los últimos 10 registros para reducir carga
      const { data: recentData, error: recentError } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used, operation, created_at')
        .eq('user_id', userId)
        .not('tokens_used', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) {
        console.warn('Error getting recent token usage:', recentError);
      }

      const records = recentData || [];

      // Agrupar por operación solo los registros recientes
      const stats = records.reduce((acc, record) => {
        const operation = record.operation || 'unknown';
        if (!acc[operation]) {
          acc[operation] = {
            total_tokens: 0,
            count: 0
          };
        }
        acc[operation].total_tokens += record.tokens_used || 0;
        acc[operation].count += 1;
        return acc;
      }, {});

      const result = {
        total_tokens: totalTokensUsed,
        by_operation: stats,
        records: records
      };
      
      // Guardar en cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error('Error getting token usage stats:', error);
      // Retornar datos por defecto en caso de error
      const defaultResult = {
        total_tokens: 0,
        by_operation: {},
        records: []
      };
      
      // Guardar resultado por defecto en cache para evitar consultas repetidas
      this.cache.set(cacheKey, {
        data: defaultResult,
        timestamp: Date.now()
      });
      
      return defaultResult;
    }
  }

  // Verificar límites de tokens según el plan con cache
  async checkTokenLimits(userId) {
    const cacheKey = `token_limits_${userId}`;
    const cached = this.cache.get(cacheKey);
    
    // Verificar cache
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log('EmbeddingsService: Returning cached token limits:', cached.data);
      return cached.data;
    }
    
    console.log('EmbeddingsService: Cache miss or expired, fetching fresh token limits for userId:', userId);
    
    try {
      // Obtener tokens usados con maybeSingle para evitar errores
      const { data: tokenUsage, error: tokenError } = await supabase
        .from('user_tokens_usage')
        .select('total_tokens, tokens_used')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (tokenError) {
        console.warn('Error getting token usage:', tokenError);
      }

      const tokensUsed = tokenUsage?.tokens_used || 0;
      const totalTokensFromPlan = tokenUsage?.total_tokens || 0;

      // Obtener información del usuario y su plan
      console.log('EmbeddingsService: Fetching user and plan data for userId:', userId);
      const { data: user, error: userError } = await supabase
        .from('users')
        .select(`
          current_plan_id,
          is_active,
          plans!inner(
            token_limit_usage
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      console.log('EmbeddingsService: User query result:', { user, userError });

      if (userError) {
        console.warn('Error getting user info:', userError);
      }

      // Usar el límite de tokens del plan como fuente de verdad
      let tokenLimit = user?.plans?.token_limit_usage || 1000; // valor por defecto para plan gratuito
      console.log('EmbeddingsService: Token limit determined:', tokenLimit, 'from plan:', user?.plans?.token_limit_usage);

      const result = {
        tokens_used: tokensUsed,
        token_limit: tokenLimit,
        remaining_tokens: Math.max(0, tokenLimit - tokensUsed),
        usage_percentage: Math.min(100, (tokensUsed / tokenLimit) * 100)
      };
      
      // Guardar en cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error('Error checking token limits:', error);
      // Retornar límites por defecto en caso de error
      const defaultResult = {
        tokens_used: 0,
        token_limit: 1000,
        remaining_tokens: 1000,
        usage_percentage: 0
      };
      
      // Guardar resultado por defecto en cache
      this.cache.set(cacheKey, {
        data: defaultResult,
        timestamp: Date.now()
      });
      
      return defaultResult;
    }
  }
}

const embeddingsService = new EmbeddingsService();
export default embeddingsService;
