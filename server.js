const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // Cargar variables de entorno
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de Mercado Pago
const mpAccessToken = process.env.REACT_APP_MERCADO_PAGO_ACCESS_TOKEN;
const client = new MercadoPagoConfig({ accessToken: mpAccessToken });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://leoyybfbnjajkktprhro.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb3l5YmZibmphamtrdHByaHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ0MTYsImV4cCI6MjA2NDM5MDQxNn0.VfJoDIHgXB1k4kwgndmr2yLNDeDBBIrOVsbqaSWrjHU';
const supabase = createClient(supabaseUrl, supabaseKey);

// Endpoint para crear preferencia de Mercado Pago
app.post('/api/create_preference', async (req, res) => {
  try {
    const { items, payer, metadata, back_urls } = req.body;
    
    if (!mpAccessToken) {
      console.error('❌ Mercado Pago Access Token no configurado en variables de entorno');
      return res.status(500).json({ error: 'Mercado Pago Access Token no configurado' });
    }

    console.log('📝 Creando preferencia MP con datos:', JSON.stringify({ items, payer, metadata }, null, 2));

    const preference = new Preference(client);
    
    // Determinar URL base para redirección
    const isDev = process.env.NODE_ENV !== 'production';
    
    // Configuración robusta de URL base para producción
    // Prioridad: 1. Variable de entorno FRONTEND_URL, 2. URL hardcodeada de producción, 3. Detección automática
    let baseUrl;
    if (process.env.FRONTEND_URL) {
      baseUrl = process.env.FRONTEND_URL;
    } else if (!isDev) {
      baseUrl = 'https://agente.brifyai.com';
    } else {
      baseUrl = 'http://localhost:3000';
    }

    // Asegurar que no termine en slash
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    console.log(`🔗 Usando Base URL para redirecciones: ${baseUrl}`);

    // Validar que back_urls tenga estructura correcta
    const successUrl = back_urls?.success || `${baseUrl}/payment/result`;
    const failureUrl = back_urls?.failure || `${baseUrl}/payment/result`;
    const pendingUrl = back_urls?.pending || `${baseUrl}/payment/result`;

    const preferenceBody = {
      items,
      payer,
      metadata,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl
      },
      auto_return: 'approved',
    };

    console.log('🚀 Enviando preferencia a Mercado Pago:', JSON.stringify(preferenceBody, null, 2));

    const result = await preference.create({
      body: preferenceBody
    });

    res.json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error('Error creando preferencia MP:', error);
    res.status(500).json({ error: 'Error al crear la preferencia de pago', details: error.message });
  }
});

// Endpoint para verificar pago
app.post('/api/verify_payment', async (req, res) => {
  try {
    const { payment_id } = req.body;
    
    if (!payment_id) {
      return res.status(400).json({ error: 'Payment ID requerido' });
    }

    const payment = new Payment(client);
    const paymentData = await payment.get({ id: payment_id });

    res.json({
      status: paymentData.status,
      status_detail: paymentData.status_detail,
      metadata: paymentData.metadata,
      transaction_amount: paymentData.transaction_amount,
      currency_id: paymentData.currency_id,
      date_approved: paymentData.date_approved
    });

  } catch (error) {
    console.error('Error verificando pago MP:', error);
    res.status(500).json({ error: 'Error al verificar el pago', details: error.message });
  }
});

// Función para extraer el ID del archivo de la URI de Google Drive
function extractFileIdFromUri(resourceUri) {
  if (!resourceUri) return null;
  
  // Buscar patrones comunes en las URIs de Google Drive
  const patterns = [
    /\/files\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/([a-zA-Z0-9_-]{25,})/
  ];
  
  for (const pattern of patterns) {
    const match = resourceUri.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Función para obtener detalles del archivo desde Google Drive API
async function getFileDetails(fileId, accessToken) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const drive = google.drive({ 
      version: 'v3',
      auth: oauth2Client
    });
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,parents,owners,webViewLink'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error obteniendo detalles del archivo:', error);
    return null;
  }
}

// Endpoint para recibir notificaciones de Google Drive desde n8n
app.post('/api/webhook/drive-notifications', async (req, res) => {
  try {
    console.log('📨 Notificación recibida desde n8n:', JSON.stringify(req.body, null, 2));
    
    const { headers, body, processedData } = req.body;
    
    if (!headers) {
      return res.status(400).json({ 
        success: false, 
        error: 'Headers requeridos no encontrados' 
      });
    }
    
    // Extraer información de los headers
    const channelId = headers['x-goog-channel-id'];
    const resourceState = headers['x-goog-resource-state'];
    const resourceUri = headers['x-goog-resource-uri'];
    const changed = headers['x-goog-changed'];
    const messageNumber = headers['x-goog-message-number'];
    
    console.log('🔍 Datos extraídos:', {
      channelId,
      resourceState,
      resourceUri,
      changed,
      messageNumber
    });
    
    if (!channelId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Channel ID no encontrado en headers' 
      });
    }
    
    // Buscar el watch channel en la base de datos
    // Buscar por 'channel_id' que es el campo que contiene el ID del canal de Google Drive
    const { data: watchChannel, error: watchError } = await supabase
      .from('drive_watch_channels')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();
    
    if (watchError || !watchChannel) {
      console.error('❌ Watch channel no encontrado:', watchError);
      console.error('❌ Detalles del error:', JSON.stringify(watchError, null, 2));
      return res.status(404).json({ 
        success: false, 
        error: 'Watch channel no encontrado o inactivo',
        details: watchError?.message 
      });
    }
    
    console.log('✅ Watch channel encontrado:', watchChannel);
    
    // Obtener credenciales de Google del usuario (opcional para esta prueba)
    let userCredentials = null;
    try {
      const { data, error } = await supabase
        .from('user_credentials')
        .select('google_access_token')
        .eq('user_id', watchChannel.user_id)
        .single();
      
      if (!error) {
        userCredentials = data;
        console.log('🔑 Credenciales obtenidas correctamente');
      } else {
        console.log('⚠️ No se pudieron obtener credenciales:', error.message);
      }
    } catch (err) {
      console.log('⚠️ Error al obtener credenciales:', err.message);
    }
    
    console.log('✅ Watch channel encontrado:', watchChannel.id);
    
    // Extraer ID del archivo de la URI
    const fileId = extractFileIdFromUri(resourceUri);
    console.log('📁 ID del archivo extraído:', fileId);
    
    // Obtener detalles del archivo si tenemos el ID
    let fileDetails = null;
    if (fileId && userCredentials?.google_access_token) {
      fileDetails = await getFileDetails(fileId, userCredentials.google_access_token);
      console.log('📋 Detalles del archivo:', fileDetails);
    }
    
    // Determinar el tipo de cambio
    let changeType = 'unknown';
    if (resourceState === 'update') {
      if (changed === 'children') {
        changeType = 'file_added_or_removed';
      } else if (changed === 'content') {
        changeType = 'file_modified';
      } else if (changed === 'permissions') {
        changeType = 'permissions_changed';
      }
    } else if (resourceState === 'trash') {
      changeType = 'file_trashed';
    } else if (resourceState === 'sync') {
      changeType = 'sync_event';
    }
    
    console.log('🔄 Tipo de cambio determinado:', changeType);
    
    // Guardar la notificación en la base de datos
    const notificationData = {
      channel_id: channelId,
      resource_state: resourceState,
      resource_uri: resourceUri,
      changed_files: changed,
      notification_data: {
        headers: headers,
        body: body,
        processedData: processedData,
        fileDetails: fileDetails,
        changeType: changeType,
        fileId: fileId
      },
      processed_at: new Date().toISOString()
    };
    
    const { data: savedNotification, error: saveError } = await supabase
      .from('drive_notifications')
      .insert(notificationData)
      .select()
      .single();
    
    if (saveError) {
      console.error('❌ Error guardando notificación:', saveError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error guardando notificación en la base de datos' 
      });
    }
    
    console.log('✅ Notificación guardada exitosamente:', savedNotification.id);
    
    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Notificación procesada exitosamente',
      data: {
        notificationId: savedNotification.id,
        changeType: changeType,
        fileId: fileId,
        fileName: fileDetails?.name || 'Desconocido',
        resourceState: resourceState,
        changed: changed
      }
    });
    
  } catch (error) {
    console.error('💥 Error procesando notificación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Endpoint de prueba
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Servir archivos estáticos de React en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 Modo desarrollo: React debe ejecutarse por separado en puerto 3000');
  }
});