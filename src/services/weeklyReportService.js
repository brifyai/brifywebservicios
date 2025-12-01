import insightsService from './insightsService'

class WeeklyReportService {
  constructor() {
    this.isScheduled = false
  }

  // Generar resumen semanal automático
  async generateWeeklySummary(userEmail) {
    try {
      const currentWeekStats = await insightsService.getCurrentWeekStats(userEmail)
      const previousWeekStats = await insightsService.getPreviousWeekStats(userEmail)
      
      const summary = {
        week_start: currentWeekStats.week_start_date,
        week_end: new Date(new Date(currentWeekStats.week_start_date).getTime() + 6 * 24 * 60 * 60 * 1000),
        user_email: userEmail,
        total_searches: currentWeekStats.total_searches || 0,
        semantic_searches: currentWeekStats.semantic_searches || 0,
        chat_conversations: currentWeekStats.chat_ia_conversations || 0,
        tokens_used: currentWeekStats.tokens_used || 0,
        documents_processed: currentWeekStats.documents_processed || 0,
        documents_uploaded: currentWeekStats.documents_uploaded || 0,
        
        // Cálculos de crecimiento
        search_growth: this.calculateGrowth(
          currentWeekStats.total_searches, 
          previousWeekStats?.total_searches
        ),
        token_growth: this.calculateGrowth(
          currentWeekStats.tokens_used, 
          previousWeekStats?.tokens_used
        ),
        document_growth: this.calculateGrowth(
          currentWeekStats.documents_processed, 
          previousWeekStats?.documents_processed
        ),
        
        // Insights y recomendaciones
        insights: this.generateInsights(currentWeekStats, previousWeekStats),
        recommendations: this.generateRecommendations(currentWeekStats, previousWeekStats)
      }

      // Guardar resumen en la base de datos
      await this.saveWeeklySummary(summary)
      
      return summary
    } catch (error) {
      console.error('Error generando resumen semanal:', error)
      throw error
    }
  }

  // Calcular crecimiento porcentual
  calculateGrowth(current, previous) {
    if (!previous || previous === 0) {
      return current > 0 ? 100 : 0
    }
    return Math.round(((current - previous) / previous) * 100)
  }

  // Generar insights automáticos
  generateInsights(current, previous) {
    const insights = []

    // Insight sobre búsquedas
    if (current.total_searches > 0) {
      const searchGrowth = this.calculateGrowth(current.total_searches, previous?.total_searches)
      if (searchGrowth > 20) {
        insights.push({
          type: 'positive',
          title: 'Actividad de búsqueda en aumento',
          description: `Tus búsquedas aumentaron un ${searchGrowth}% esta semana`
        })
      } else if (searchGrowth < -20) {
        insights.push({
          type: 'attention',
          title: 'Menor actividad de búsqueda',
          description: `Tus búsquedas disminuyeron un ${Math.abs(searchGrowth)}% esta semana`
        })
      }
    }

    // Insight sobre tokens
    if (current.tokens_used > 0) {
      const tokenGrowth = this.calculateGrowth(current.tokens_used, previous?.tokens_used)
      if (tokenGrowth > 50) {
        insights.push({
          type: 'attention',
          title: 'Alto uso de tokens',
          description: `El uso de tokens aumentó un ${tokenGrowth}% esta semana`
        })
      }
    }

    // Insight sobre documentos
    if (current.documents_uploaded > 0) {
      insights.push({
        type: 'positive',
        title: 'Nuevos documentos procesados',
        description: `Se procesaron ${current.documents_uploaded} nuevos documentos esta semana`
      })
    }

    return insights
  }

  // Generar recomendaciones automáticas
  generateRecommendations(current, previous) {
    const recommendations = []

    // Recomendación basada en uso de búsquedas
    if (current.total_searches < 5) {
      recommendations.push({
        priority: 'medium',
        title: 'Explora más funcionalidades',
        description: 'Considera usar más la búsqueda semántica para obtener mejores resultados'
      })
    }

    // Recomendación basada en tokens
    const tokenUsagePercent = current.tokens_limit > 0 ? 
      (current.tokens_used / current.tokens_limit) * 100 : 0
    
    if (tokenUsagePercent > 80) {
      recommendations.push({
        priority: 'high',
        title: 'Límite de tokens cercano',
        description: 'Considera optimizar tus consultas o actualizar tu plan'
      })
    }

    // Recomendación basada en documentos
    if (current.documents_uploaded === 0 && current.total_searches > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Sube más documentos',
        description: 'Agregar más documentos mejorará la calidad de las búsquedas'
      })
    }

    return recommendations
  }

  // Guardar resumen en la base de datos
  async saveWeeklySummary(summary) {
    try {
      const response = await fetch('/api/insights/weekly-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(summary)
      })

      if (!response.ok) {
        throw new Error('Error guardando resumen semanal')
      }

      return await response.json()
    } catch (error) {
      console.error('Error guardando resumen semanal:', error)
      throw error
    }
  }

  // Obtener resúmenes semanales del usuario
  async getWeeklySummaries(userEmail, limit = 4) {
    try {
      const response = await fetch(`/api/insights/weekly-summaries?email=${userEmail}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Error obteniendo resúmenes semanales')
      }

      return await response.json()
    } catch (error) {
      console.error('Error obteniendo resúmenes semanales:', error)
      throw error
    }
  }

  // Programar generación automática de resúmenes
  scheduleWeeklyReports() {
    if (this.isScheduled) return

    // Ejecutar cada domingo a las 23:59
    const scheduleNextReport = () => {
      const now = new Date()
      const nextSunday = new Date()
      
      // Calcular próximo domingo
      const daysUntilSunday = (7 - now.getDay()) % 7
      nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday))
      nextSunday.setHours(23, 59, 0, 0)
      
      const timeUntilNextReport = nextSunday.getTime() - now.getTime()
      
      setTimeout(async () => {
        try {
          // Obtener todos los usuarios activos y generar sus resúmenes
          const activeUsers = await this.getActiveUsers()
          
          for (const user of activeUsers) {
            await this.generateWeeklySummary(user.email)
          }
          
          console.log('Resúmenes semanales generados automáticamente')
          
          // Programar el siguiente reporte
          scheduleNextReport()
        } catch (error) {
          console.error('Error en generación automática de resúmenes:', error)
          // Reintentar en 1 hora
          setTimeout(scheduleNextReport, 60 * 60 * 1000)
        }
      }, timeUntilNextReport)
    }

    scheduleNextReport()
    this.isScheduled = true
    console.log('Sistema de resúmenes semanales programado')
  }

  // Obtener usuarios activos (que han usado el sistema en la última semana)
  async getActiveUsers() {
    try {
      const response = await fetch('/api/insights/active-users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Error obteniendo usuarios activos')
      }

      return await response.json()
    } catch (error) {
      console.error('Error obteniendo usuarios activos:', error)
      return []
    }
  }

  // Generar resumen manual para un usuario específico
  async generateManualSummary(userEmail) {
    return await this.generateWeeklySummary(userEmail)
  }
}

export const weeklyReportService = new WeeklyReportService()