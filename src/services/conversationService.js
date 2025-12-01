import { supabase } from '../lib/supabase'
import insightsService from './insightsService'

class ConversationService {
  /**
   * Registra una nueva conversación para un usuario
   * @param {string} userEmail - Email del usuario
   * @param {string} tipo - Tipo de conversación: 'chat_general', 'busqueda_semantica', 'chat_ia'
   * @param {string} pregunta - La pregunta del usuario
   * @param {string} respuesta - La respuesta generada
   */
  async registrarConversacion(userEmail, tipo, pregunta, respuesta) {
    try {
      // Crear el objeto de conversación
      const nuevaConversacion = {
        id: crypto.randomUUID(),
        tipo,
        pregunta: pregunta.substring(0, 500), // Limitar longitud
        respuesta: respuesta.substring(0, 1000), // Limitar longitud
        fecha: new Date().toISOString()
      }

      // Obtener conversaciones existentes del usuario
      const { data: usuarioExistente, error: errorConsulta } = await supabase
        .from('conversaciones_usuario')
        .select('conversaciones')
        .eq('usuario_email', userEmail)
        .single()

      let conversacionesActuales = []
      
      if (usuarioExistente && !errorConsulta) {
        // Usuario existe, obtener conversaciones actuales
        conversacionesActuales = usuarioExistente.conversaciones || []
      }

      // Agregar nueva conversación al inicio
      conversacionesActuales.unshift(nuevaConversacion)

      // Mantener solo las 5 más recientes
      if (conversacionesActuales.length > 5) {
        conversacionesActuales = conversacionesActuales.slice(0, 5)
      }

      // Actualizar o insertar registro
      const { error } = await supabase
        .from('conversaciones_usuario')
        .upsert({
          usuario_email: userEmail,
          conversaciones: conversacionesActuales
        }, {
          onConflict: 'usuario_email'
        })

      if (error) {
        console.error('Error al registrar conversación:', error)
        return false
      }

      // Registrar actividad en insights (nuevo)
      const searchType = tipo === 'chat_ia' ? 'chat_ia' : 'semantic'
      await insightsService.trackSearchActivity(userEmail, searchType)

      return true
    } catch (error) {
      console.error('Error en registrarConversacion:', error)
      return false
    }
  }

  /**
   * Obtiene las conversaciones de un usuario
   * @param {string} userEmail - Email del usuario
   * @returns {Array} Array de conversaciones
   */
  async obtenerConversaciones(userEmail) {
    try {
      const { data, error } = await supabase
        .from('conversaciones_usuario')
        .select('conversaciones')
        .eq('usuario_email', userEmail)
        .single()

      if (error || !data) {
        return []
      }

      return data.conversaciones || []
    } catch (error) {
      console.error('Error al obtener conversaciones:', error)
      return []
    }
  }

  /**
   * Obtiene las últimas actividades basadas en conversaciones
   * @param {string} userEmail - Email del usuario
   * @returns {Array} Array de actividades formateadas
   */
  async obtenerUltimasActividades(userEmail) {
    try {
      const conversaciones = await this.obtenerConversaciones(userEmail)
      
      return conversaciones.map(conv => ({
        id: conv.id,
        tipo: this.formatearTipoActividad(conv.tipo),
        descripcion: conv.pregunta,
        fecha: conv.fecha,
        icono: this.obtenerIconoActividad(conv.tipo)
      }))
    } catch (error) {
      console.error('Error al obtener últimas actividades:', error)
      return []
    }
  }

  /**
   * Formatea el tipo de actividad para mostrar
   * @param {string} tipo - Tipo de conversación
   * @returns {string} Tipo formateado
   */
  formatearTipoActividad(tipo) {
    const tipos = {
      'chat_general': 'Chat General',
      'busqueda_semantica': 'Búsqueda Semántica',
      'chat_ia': 'Chat IA',
      'chat_legal': 'Chat Legal'
    }
    return tipos[tipo] || tipo
  }

  /**
   * Obtiene el icono para el tipo de actividad
   * @param {string} tipo - Tipo de conversación
   * @returns {string} Nombre del icono
   */
  obtenerIconoActividad(tipo) {
    const iconos = {
      'chat_general': 'ChatBubbleLeftRightIcon',
      'busqueda_semantica': 'MagnifyingGlassIcon',
      'chat_ia': 'SparklesIcon',
      'chat_legal': 'ScaleIcon'
    }
    return iconos[tipo] || 'ChatBubbleLeftRightIcon'
  }
}

export default new ConversationService()