// SCRIPT COMPLETO PARA PROCESAR WEBHOOK DE GOOGLE DRIVE
// Copia este código en tu Code Node de n8n
// Te entrega TODA la información del archivo que cambió

// ===== CONFIGURACIÓN =====
const ACCESS_TOKEN = 'TU_ACCESS_TOKEN_AQUI'; // Reemplaza con tu token
const WEBHOOK_DATA = $input.all()[0].json;

// ===== FUNCIÓN PRINCIPAL =====
async function processGoogleDriveWebhook() {
  try {
    // 1. EXTRAER DATOS DEL WEBHOOK
    const headers = WEBHOOK_DATA.headers || {};
    
    const webhookInfo = {
      channel_id: headers['x-goog-channel-id'],
      resource_state: headers['x-goog-resource-state'],
      resource_id: headers['x-goog-resource-id'],
      resource_uri: headers['x-goog-resource-uri'],
      message_number: headers['x-goog-message-number'],
      channel_token: headers['x-goog-channel-token'],
      expiration: headers['x-goog-channel-expiration'],
      timestamp: new Date().toISOString()
    };

    // 2. EXTRAER FOLDER ID
    let folderId = null;
    if (webhookInfo.resource_uri) {
      const folderMatch = webhookInfo.resource_uri.match(/files\/([a-zA-Z0-9_-]+)/);
      folderId = folderMatch ? folderMatch[1] : null;
    }

    // 3. CONSULTAR GOOGLE DRIVE API PARA OBTENER ARCHIVOS RECIENTES
    let fileDetails = null;
    let apiError = null;
    
    if (folderId && ACCESS_TOKEN !== 'TU_ACCESS_TOKEN_AQUI') {
      try {
        // Consultar archivos modificados en los últimos 10 minutos
        const timeFilter = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const query = `parents in '${folderId}' and modifiedTime > '${timeFilter}'`;
        const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,modifiedTime,createdTime,size,mimeType,parents,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress),webViewLink,webContentLink)`;
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          fileDetails = data.files || [];
        } else {
          apiError = `API Error: ${response.status} - ${response.statusText}`;
        }
      } catch (error) {
        apiError = `Fetch Error: ${error.message}`;
      }
    }

    // 4. DETERMINAR ARCHIVO QUE CAMBIÓ
    let changedFile = null;
    if (fileDetails && fileDetails.length > 0) {
      // El archivo más reciente es probablemente el que causó la notificación
      changedFile = fileDetails[0];
    }

    // 5. PREPARAR DATOS COMPLETOS PARA SUPABASE
    const supabaseData = {
      // Datos básicos del webhook
      channel_id: webhookInfo.channel_id,
      resource_id: webhookInfo.resource_id,
      resource_state: webhookInfo.resource_state,
      event_type: determineEventType(webhookInfo.resource_state),
      folder_id: folderId,
      resource_uri: webhookInfo.resource_uri,
      
      // Datos del archivo (si se encontró)
      file_id: changedFile ? changedFile.id : null,
      file_name: changedFile ? changedFile.name : null,
      file_size: changedFile ? changedFile.size : null,
      file_mime_type: changedFile ? changedFile.mimeType : null,
      file_modified_time: changedFile ? changedFile.modifiedTime : null,
      file_created_time: changedFile ? changedFile.createdTime : null,
      file_web_link: changedFile ? changedFile.webViewLink : null,
      
      // Datos adicionales en JSONB
      notification_data: {
        webhook_headers: headers,
        message_number: webhookInfo.message_number,
        channel_token: webhookInfo.channel_token,
        timestamp: webhookInfo.timestamp,
        source: 'n8n_complete_processor',
        
        // Información del archivo completa
        file_details: changedFile ? {
          id: changedFile.id,
          name: changedFile.name,
          size: changedFile.size,
          mimeType: changedFile.mimeType,
          modifiedTime: changedFile.modifiedTime,
          createdTime: changedFile.createdTime,
          parents: changedFile.parents,
          owners: changedFile.owners,
          lastModifyingUser: changedFile.lastModifyingUser,
          webViewLink: changedFile.webViewLink,
          webContentLink: changedFile.webContentLink
        } : null,
        
        // Todos los archivos encontrados (para debug)
        all_recent_files: fileDetails,
        
        // Información de errores si los hay
        api_error: apiError,
        
        // Configuración usada
        query_config: {
          folder_id: folderId,
          time_filter_minutes: 10,
          max_files: 5
        }
      },
      
      // Estado
      processed: false,
      created_at: webhookInfo.timestamp
    };

    // 6. INFORMACIÓN ADICIONAL PARA DEBUG
    const debugInfo = {
      webhook_processed: true,
      folder_id_found: !!folderId,
      api_call_made: ACCESS_TOKEN !== 'TU_ACCESS_TOKEN_AQUI',
      file_detected: !!changedFile,
      files_found_count: fileDetails ? fileDetails.length : 0,
      api_error: apiError,
      
      summary: {
        channel_id: webhookInfo.channel_id,
        folder_id: folderId,
        file_name: changedFile ? changedFile.name : 'No detectado',
        file_id: changedFile ? changedFile.id : 'No detectado',
        change_type: determineEventType(webhookInfo.resource_state),
        timestamp: webhookInfo.timestamp
      }
    };

    // 7. RETORNAR DATOS COMPLETOS
    return {
      // DATOS LISTOS PARA INSERTAR EN SUPABASE
      supabase_insert: supabaseData,
      
      // INFORMACIÓN DEL ARCHIVO ESPECÍFICO
      file_info: changedFile ? {
        id: changedFile.id,
        name: changedFile.name,
        size: changedFile.size,
        type: changedFile.mimeType,
        modified: changedFile.modifiedTime,
        created: changedFile.createdTime,
        link: changedFile.webViewLink,
        download_link: changedFile.webContentLink,
        owner: changedFile.owners ? changedFile.owners[0]?.displayName : 'Desconocido',
        last_modifier: changedFile.lastModifyingUser ? changedFile.lastModifyingUser.displayName : 'Desconocido'
      } : null,
      
      // INFORMACIÓN DEL WEBHOOK
      webhook_info: webhookInfo,
      
      // DEBUG Y STATUS
      debug: debugInfo,
      
      // TODOS LOS ARCHIVOS RECIENTES (para análisis)
      all_recent_files: fileDetails,
      
      // CONFIGURACIÓN PARA PRÓXIMOS PASOS
      next_steps: {
        insert_query: `INSERT INTO drive_notifications (channel_id, resource_id, resource_state, event_type, folder_id, resource_uri, notification_data, processed) VALUES ('${webhookInfo.channel_id}', '${webhookInfo.resource_id}', '${webhookInfo.resource_state}', '${determineEventType(webhookInfo.resource_state)}', '${folderId}', '${webhookInfo.resource_uri}', '${JSON.stringify(supabaseData.notification_data)}', false)`,
        
        user_id_query: `SELECT user_id FROM drive_watch_channels WHERE channel_id = '${webhookInfo.channel_id}'`,
        
        recommendations: [
          'Usar supabase_insert para insertar en drive_notifications',
          'Usar file_info para mostrar al usuario qué archivo cambió',
          'Usar user_id_query para obtener el usuario asociado',
          'Verificar debug.api_error si hay problemas'
        ]
      }
    };

  } catch (error) {
    return {
      error: true,
      message: error.message,
      stack: error.stack,
      webhook_data: WEBHOOK_DATA
    };
  }
}

// ===== FUNCIÓN AUXILIAR =====
function determineEventType(resourceState) {
  switch (resourceState) {
    case 'update': return 'file_changed';
    case 'sync': return 'sync';
    case 'exists': return 'file_exists';
    default: return resourceState || 'unknown';
  }
}

// ===== EJECUTAR Y RETORNAR =====
const result = await processGoogleDriveWebhook();
return [result];

// ===== INSTRUCCIONES DE USO =====
/*
PARA USAR ESTE SCRIPT:

1. Reemplaza 'TU_ACCESS_TOKEN_AQUI' con tu token de Google Drive API
2. Copia este código en un Code Node de n8n
3. El script te retorna:
   - supabase_insert: Datos listos para insertar en Supabase
   - file_info: Información específica del archivo que cambió
   - webhook_info: Datos del webhook original
   - debug: Información de debug y status
   - all_recent_files: Todos los archivos recientes encontrados

EJEMPLO DE USO EN N8N:
1. Webhook Trigger (recibe notificación)
2. Este Code Node (procesa y obtiene info del archivo)
3. Supabase Insert Node (usa el campo 'supabase_insert')

EL SCRIPT TE DICE:
- Qué archivo específico cambió (nombre, ID, tamaño, etc.)
- Quién lo modificó
- Cuándo se modificó
- Enlace para verlo/descargarlo
- Todos los datos necesarios para Supabase

SI HAY ERRORES:
- Revisa el campo 'debug.api_error'
- Verifica que el ACCESS_TOKEN sea válido
- Confirma que el folder_id se extrajo correctamente
*/