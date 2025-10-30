// Handler para webhook de Google Drive desde n8n
// Procesa las notificaciones recibidas y las envía al procesador

import DriveNotificationProcessor from './driveNotificationProcessor.js';

class WebhookHandler {
  /**
   * Maneja las notificaciones recibidas del webhook de n8n
   * @param {Object} webhookData - Datos recibidos del webhook
   * @returns {Object} Resultado del procesamiento
   */
  static async handleDriveNotification(webhookData) {
    try {
      console.log('🎯 Webhook recibido de n8n:', JSON.stringify(webhookData, null, 2));
      
      // Validar que tenemos los datos necesarios
      if (!webhookData || !webhookData.headers) {
        throw new Error('Datos de webhook inválidos: faltan headers');
      }
      
      // Verificar que es una notificación de Google Drive
      const channelId = webhookData.headers['x-goog-channel-id'];
      if (!channelId) {
        throw new Error('No es una notificación válida de Google Drive: falta x-goog-channel-id');
      }
      
      console.log(`📡 Procesando notificación del canal: ${channelId}`);
      
      // Procesar la notificación
      const result = await DriveNotificationProcessor.processNotification(webhookData);
      
      if (result.success) {
        console.log('✅ Notificación procesada exitosamente');
        console.log('📊 Resumen:', {
          changeType: result.changeType,
          fileName: result.fileDetails?.name || 'N/A',
          isFolder: result.fileDetails?.isFolder || false,
          resourceState: result.notificationInfo.resourceState,
          changedType: result.notificationInfo.changedType
        });
        
        return {
          success: true,
          message: 'Notificación procesada correctamente',
          data: {
            changeType: result.changeType,
            fileName: result.fileDetails?.name,
            isFolder: result.fileDetails?.isFolder,
            timestamp: result.notificationInfo.timestamp
          }
        };
      } else {
        console.error('❌ Error procesando notificación:', result.error);
        return {
          success: false,
          message: 'Error procesando notificación',
          error: result.error
        };
      }
      
    } catch (error) {
      console.error('💥 Error en webhook handler:', error);
      return {
        success: false,
        message: 'Error interno del webhook handler',
        error: error.message
      };
    }
  }
  
  /**
   * Función para probar el webhook handler con datos de ejemplo
   * @param {Object} testData - Datos de prueba (opcional)
   */
  static async testWebhookHandler(testData = null) {
    console.log('🧪 Iniciando prueba del webhook handler...');
    
    // Datos de ejemplo basados en tu log real
    const exampleData = testData || {
      headers: {
        "host": "n8n-service-aintelligence.captain.maquinaintelligence.xyz",
        "x-real-ip": "66.102.6.76",
        "x-forwarded-for": "66.102.6.76",
        "x-forwarded-proto": "https",
        "connection": "upgrade",
        "content-length": "0",
        "accept": "*/*",
        "x-goog-channel-id": "6e32b6bc-2f15-471d-9e25-8c74cb17af36",
        "x-goog-channel-expiration": "Tue, 02 Sep 2025 02:01:01 GMT",
        "x-goog-resource-state": "update",
        "x-goog-changed": "children",
        "x-goog-message-number": "2246193",
        "x-goog-resource-id": "-WTRHa6IbO2ykuu1lCM-PH6gXSU",
        "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/files/1_-oCgWAyfD_3q-1fN5CUrP8Z_qknRhqz?alt=json&null",
        "x-goog-channel-token": "f912b488-ca28-4d9b-a70c-b59c083fc943",
        "user-agent": "APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html)",
        "accept-encoding": "gzip, deflate, br"
      },
      params: {},
      query: {},
      body: {},
      webhookUrl: "https://n8n-service-aintelligence.captain.maquinaintelligence.xyz/webhook/3db9b1f5-fdc7-4976-bacb-9802dff27135",
      executionMode: "production"
    };
    
    try {
      const result = await this.handleDriveNotification(exampleData);
      console.log('🎯 Resultado de la prueba:', result);
      return result;
    } catch (error) {
      console.error('❌ Error en la prueba:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Función para integrar con n8n - puede ser llamada desde el workflow
   * @param {string} webhookDataJson - JSON string con los datos del webhook
   * @returns {Object} Resultado del procesamiento
   */
  static async processFromN8N(webhookDataJson) {
    try {
      let webhookData;
      
      // Si recibimos un string JSON, parsearlo
      if (typeof webhookDataJson === 'string') {
        webhookData = JSON.parse(webhookDataJson);
      } else {
        webhookData = webhookDataJson;
      }
      
      // Si los datos vienen en un array (como en tu log), tomar el primer elemento
      if (Array.isArray(webhookData) && webhookData.length > 0) {
        webhookData = webhookData[0];
      }
      
      return await this.handleDriveNotification(webhookData);
      
    } catch (error) {
      console.error('❌ Error procesando desde n8n:', error);
      return {
        success: false,
        message: 'Error parseando datos de n8n',
        error: error.message
      };
    }
  }
}

// Función global para usar en el navegador o desde n8n
if (typeof window !== 'undefined') {
  window.WebhookHandler = WebhookHandler;
}

export default WebhookHandler;

// Ejemplo de uso:
// 
// En el navegador:
// await WebhookHandler.testWebhookHandler();
// 
// Desde n8n (en un nodo de código):
// const result = await WebhookHandler.processFromN8N($json);
// return result;