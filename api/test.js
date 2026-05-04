module.exports = (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'API Serverless funcionando correctamente',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
};
