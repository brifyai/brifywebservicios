const { MercadoPagoConfig, Preference } = require('mercadopago');

// Configuración de Mercado Pago
const mpAccessToken = process.env.REACT_APP_MERCADO_PAGO_ACCESS_TOKEN;
const client = new MercadoPagoConfig({ accessToken: mpAccessToken });

module.exports = async (req, res) => {
  // Configuración CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Ajustar según necesidades de seguridad
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { items, payer, metadata, back_urls } = req.body;
    
    if (!mpAccessToken) {
      console.error('❌ Mercado Pago Access Token no configurado');
      return res.status(500).json({ error: 'Mercado Pago Access Token no configurado' });
    }

    // Determinar URL base
    // Vercel provee 'x-forwarded-host' y 'x-forwarded-proto'
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    
    let baseUrl;
    if (process.env.FRONTEND_URL) {
      baseUrl = process.env.FRONTEND_URL;
    } else if (host && !host.includes('localhost')) {
      baseUrl = `https://${host}`;
    } else {
      baseUrl = 'http://localhost:3000';
    }

    // Asegurar que no termine en slash
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

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

    console.log('🚀 Enviando preferencia a Mercado Pago (Serverless):', JSON.stringify(preferenceBody, null, 2));

    const preference = new Preference(client);
    const result = await preference.create({
      body: preferenceBody
    });

    res.status(200).json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error('Error creando preferencia MP:', error);
    res.status(500).json({ error: 'Error al crear la preferencia de pago', details: error.message });
  }
};
