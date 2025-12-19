const { MercadoPagoConfig, Payment } = require('mercadopago');

// Configuración de Mercado Pago
const mpAccessToken = process.env.REACT_APP_MERCADO_PAGO_ACCESS_TOKEN;
const client = new MercadoPagoConfig({ accessToken: mpAccessToken });

module.exports = async (req, res) => {
  // Configuración CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { payment_id } = req.body;
    
    if (!payment_id) {
      return res.status(400).json({ error: 'Payment ID requerido' });
    }

    if (!mpAccessToken) {
      console.error('❌ Mercado Pago Access Token no configurado');
      return res.status(500).json({ error: 'Mercado Pago Access Token no configurado' });
    }

    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: payment_id });

    res.status(200).json({
      status: paymentInfo.status,
      status_detail: paymentInfo.status_detail,
      date_approved: paymentInfo.date_approved,
      payment_method_id: paymentInfo.payment_method_id,
      transaction_amount: paymentInfo.transaction_amount
    });
  } catch (error) {
    console.error('Error verificando pago:', error);
    res.status(500).json({ error: 'Error al verificar el pago', details: error.message });
  }
};
