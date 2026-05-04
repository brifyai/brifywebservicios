import { supabase } from '../lib/supabase';

class InsightsService {
  constructor() {
    this.currentWeekStart = this.getCurrentWeekStart();
    this.previousWeekStart = this.getPreviousWeekStart();
  }

  // Utilidades para fechas
  getCurrentWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Lunes como inicio de semana
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }

  getPreviousWeekStart() {
    const currentWeek = new Date(this.currentWeekStart);
    const previousWeek = new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    return previousWeek.toISOString();
  }

  // Registrar actividad de búsqueda
  async trackSearchActivity(userEmail, searchType = 'semantic') {
    try {
      // Actualizar contador en conversaciones_usuario
      await supabase.rpc('increment_search_counter', {
        user_email: userEmail
      });

      // Actualizar estadísticas detalladas
      await supabase.rpc('update_search_stats', {
        user_email: userEmail,
        search_type: searchType
      });

      return { success: true };
    } catch (error) {
      console.error('Error tracking search activity:', error);
      return { success: false, error: error.message };
    }
  }

  // Registrar uso de tokens
  async trackTokenUsage(userEmail, tokensUsed) {
    try {
      await supabase.rpc('update_token_stats', {
        user_email: userEmail,
        tokens_consumed: tokensUsed
      });

      return { success: true };
    } catch (error) {
      console.error('Error tracking token usage:', error);
      return { success: false, error: error.message };
    }
  }

  // Registrar procesamiento de documentos
  async trackDocumentActivity(userEmail, docType = 'processed') {
    try {
      console.log('📊 Tracking document activity:', { userEmail, docType });
      
      const result = await supabase.rpc('update_document_stats', {
        user_email: userEmail,
        doc_type: docType
      });

      if (result.error) {
        console.error('❌ Error en RPC update_document_stats:', result.error);
        return { success: false, error: result.error.message };
      }

      console.log('✅ Document activity tracked successfully:', result.data);
      return { success: true };
    } catch (error) {
      console.error('Error tracking document activity:', error);
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas de la semana actual
  async getCurrentWeekStats(userEmail) {
    try {
      const weekStart = this.getCurrentWeekStart();
      
      const { data, error } = await supabase
        .from('user_insights_stats')
        .select('*')
        .eq('usuario_email', userEmail)
        .eq('week_start_date', weekStart.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error obteniendo estadísticas de la semana actual:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error en getCurrentWeekStats:', error);
      return null;
    }
  }

  // Obtener estadísticas de la semana anterior
  async getPreviousWeekStats(userEmail) {
    try {
      const currentWeekStart = this.getCurrentWeekStart();
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      const { data, error } = await supabase
        .from('user_insights_stats')
        .select('*')
        .eq('usuario_email', userEmail)
        .eq('week_start_date', previousWeekStart.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error obteniendo estadísticas de la semana anterior:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error en getPreviousWeekStats:', error);
      return null;
    }
  }

  // Obtener métricas completas para Insights
  async getInsightsData(userEmail) {
    try {
      // Primero obtener el user_id real desde la tabla users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (userError) {
        console.error('Error obteniendo user_id:', userError);
        return this.getDefaultInsights();
      }

      const userId = userData.id;

      // Obtener estadísticas actuales y anteriores
      const [currentStats, previousStats] = await Promise.all([
        this.getCurrentWeekStats(userEmail),
        this.getPreviousWeekStats(userEmail)
      ]);

      // Obtener total de tokens usados desde user_tokens_usage usando el user_id real
      const { data: tokenData, error: tokenError } = await supabase
        .from('user_tokens_usage')
        .select('tokens_used')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (tokenError && tokenError.code !== 'PGRST116') {
        console.error('Error obteniendo datos de tokens:', tokenError);
      }

      // Obtener el límite de tokens desde el plan del usuario
      let tokensLimit = 1500; // Valor por defecto
      const { data: userPlanData, error: planError } = await supabase
        .from('users')
        .select(`
          current_plan_id,
          plans!inner(
            token_limit_usage
          )
        `)
        .eq('id', userId)
        .single();

      if (!planError && userPlanData?.plans?.token_limit_usage) {
        tokensLimit = userPlanData.plans.token_limit_usage;
      }

      // Si no hay datos, obtener el total sumando todos los registros del usuario
      let totalTokensUsed = 0;

      if (tokenData && tokenData.length > 0) {
        totalTokensUsed = tokenData[0].tokens_used || 0;
      } else {
        // Si no hay registro único, sumar todos los tokens usados por el usuario
        const { data: allTokens, error: allTokensError } = await supabase
          .from('user_tokens_usage')
          .select('tokens_used')
          .eq('user_id', userId);
        
        if (!allTokensError && allTokens) {
          totalTokensUsed = allTokens.reduce((sum, record) => sum + (record.tokens_used || 0), 0);
        }
      }

      // Obtener total de conversaciones desde conversaciones_usuario
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversaciones_usuario')
        .select('conversaciones')
        .eq('usuario_email', userEmail)
        .single();

      if (conversationsError && conversationsError.code !== 'PGRST116') {
        console.error('Error obteniendo conversaciones:', conversationsError);
      }

      // Contar total de conversaciones
      let totalConversations = 0;
      if (conversationsData?.conversaciones) {
        totalConversations = conversationsData.conversaciones.length;
      }

      // Obtener total de documentos procesados desde documentos_administrador
      const { data: docsData, error: docsError } = await supabase
        .from('documentos_administrador')
        .select('id')
        .eq('administrador', userEmail);

      if (docsError) {
        console.error('Error obteniendo documentos:', docsError);
      }

      // Calcular métricas con datos reales
      const totalDocuments = docsData?.length || 0;
      
      const insights = {
        tendencias: {
          busquedas: {
            total: totalConversations, // Usar conversaciones reales como búsquedas
            porcentaje: this.calculateGrowthPercentage(
              currentStats?.total_searches || totalConversations,
              previousStats?.total_searches || 0
            )
          },
          tokensUsados: {
            total: totalTokensUsed,
            limite: tokensLimit,
            porcentaje: this.calculateUsagePercentage(totalTokensUsed, tokensLimit)
          },
          documentosProcesados: {
            total: totalDocuments,
            porcentaje: this.calculateGrowthPercentage(
              currentStats?.documents_processed || totalDocuments,
              previousStats?.documents_processed || 0
            )
          }
        },
        recomendaciones: await this.generateRecommendations(currentStats, tokenData, totalDocuments),
        resumenSemanal: await this.generateWeeklySummary(currentStats, previousStats),
        usoIA: {
          conversaciones: totalConversations,
          tokensUtilizados: totalTokensUsed // Usar el total de tokens aquí
        }
      };

      return insights;
    } catch (error) {
      console.error('Error getting insights data:', error);
      return this.getDefaultInsights();
    }
  }

  // Calcular porcentaje de crecimiento
  calculateGrowthPercentage(current, previous) {
    if (!previous || previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  }

  // Calcular porcentaje de uso
  calculateUsagePercentage(used, limit) {
    if (!limit || limit === 0) return 0;
    return Math.round((used / limit) * 100);
  }

  // Generar recomendaciones basadas en el uso
  async generateRecommendations(currentWeek, tokenData, totalDocs) {
    const recommendations = [];

    // Recomendación sobre documentos
    if (totalDocs >= 15) {
      recommendations.push({
        tipo: 'warning',
        mensaje: `Tienes ${totalDocs} documentos sin procesar, actívalos para búsquedas`
      });
    } else if (totalDocs < 5) {
      recommendations.push({
        tipo: 'info',
        mensaje: 'Considera organizar tus documentos en carpetas temáticas'
      });
    }

    // Recomendación sobre tokens
    const tokenUsagePercent = this.calculateUsagePercentage(
      tokenData?.tokens_used || 0,
      tokenData?.tokens_limit || 1500
    );

    if (tokenUsagePercent >= 80) {
      recommendations.push({
        tipo: 'warning',
        mensaje: `Has usado ${tokenUsagePercent}% de tus tokens disponibles`
      });
    } else if (tokenUsagePercent < 20) {
      recommendations.push({
        tipo: 'success',
        mensaje: `Tu uso de tokens increased un ${this.calculateGrowthPercentage(currentWeek?.total_searches || 0, 0)}% esta semana`
      });
    }

    return recommendations;
  }

  // Generar resumen semanal
  async generateWeeklySummary(currentWeek, previousWeek) {
    const searchGrowth = this.calculateGrowthPercentage(
      currentWeek?.total_searches || 0,
      previousWeek?.total_searches || 0
    );

    const docGrowth = this.calculateGrowthPercentage(
      currentWeek?.documents_processed || 0,
      previousWeek?.documents_processed || 0
    );

    return {
      actividadSemanal: `Realizaste ${currentWeek?.total_searches || 0} búsquedas y procesaste ${currentWeek?.documents_processed || 0} documentos nuevos.`,
      usoIA: `Conversaciones con IA: ${currentWeek?.chat_ia_conversations || 0}. Tokens utilizados: ${currentWeek?.tokens_used || 0}.`
    };
  }

  // Datos por defecto cuando no hay información
  getDefaultInsights() {
    return {
      tendencias: {
        busquedas: { total: 0, porcentaje: 0 },
        tokensUsados: { total: 0, limite: 1500, porcentaje: 0 },
        documentosProcesados: { total: 0, porcentaje: 0 }
      },
      recomendaciones: [
        {
          tipo: 'info',
          mensaje: 'Comienza subiendo documentos para obtener insights personalizados'
        }
      ],
      resumenSemanal: {
        actividadSemanal: 'Aún no hay actividad registrada esta semana.',
        usoIA: 'Comienza a usar las funciones de IA para ver estadísticas.'
      },
      usoIA: {
        conversaciones: 0,
        tokensUtilizados: 0
      }
    };
  }

  // Limpiar estadísticas antiguas (ejecutar semanalmente)
  async cleanupOldStats() {
    try {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const { error } = await supabase
        .from('user_insights_stats')
        .delete()
        .lt('week_start_date', fourWeeksAgo.toISOString());

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error cleaning up old stats:', error);
      return { success: false, error: error.message };
    }
  }
}

// Exportar instancia singleton
const insightsService = new InsightsService();
export default insightsService;