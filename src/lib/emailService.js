// Servicio de email para envío de correos de bienvenida
// Usando EmailJS para envío de emails sin backend

class EmailService {
  constructor() {
    // Configuración de EmailJS (necesitarás registrarte en emailjs.com)
    this.serviceId = 'service_brify' // Reemplazar con tu Service ID
    this.templateId = 'template_welcome' // Reemplazar con tu Template ID
    this.publicKey = 'YOUR_PUBLIC_KEY' // Reemplazar con tu Public Key
  }

  // Inicializar EmailJS
  async init() {
    try {
      // Cargar EmailJS dinámicamente
      if (!window.emailjs) {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js'
        document.head.appendChild(script)
        
        return new Promise((resolve, reject) => {
          script.onload = () => {
            window.emailjs.init(this.publicKey)
            resolve()
          }
          script.onerror = reject
        })
      } else {
        window.emailjs.init(this.publicKey)
      }
    } catch (error) {
      console.error('Error inicializando EmailJS:', error)
      throw error
    }
  }

  // Enviar correo de bienvenida
  async sendWelcomeEmail(clientEmail, clientName) {
    try {
      await this.init()
      
      const templateParams = {
        to_email: clientEmail,
        to_name: clientName,
        from_name: 'Brify Team',
        message: this.getWelcomeMessage(clientName)
      }

      const response = await window.emailjs.send(
        this.serviceId,
        this.templateId,
        templateParams
      )

      console.log('Correo de bienvenida enviado exitosamente:', response)
      return { success: true, response }
    } catch (error) {
      console.error('Error enviando correo de bienvenida:', error)
      return { success: false, error: error.message }
    }
  }

  // Generar mensaje de bienvenida personalizado
  getWelcomeMessage(clientName) {
    return `
¡Hola ${clientName}! 🎉

¡Te damos la bienvenida a Brify! 🚀

Te invitamos a que agregues a tu plataforma Telegram nuestro bot '@brifybeta_bot' 🤖

¡Aquí podrás preguntar y ver todo el contenido que tiene tu entrenador disponible para ti! 💪

✨ ¿Qué puedes hacer con nuestro bot?
• Hacer preguntas sobre tu entrenamiento
• Acceder a contenido personalizado
• Recibir consejos de tu entrenador
• Y mucho más...

🔗 Para comenzar, simplemente:
1. Abre Telegram
2. Busca: @brifybeta_bot
3. Inicia una conversación
4. ¡Disfruta de tu experiencia personalizada!

¡Esperamos que disfrutes de todo lo que tenemos preparado para ti! 🌟

Saludos,
El equipo de Brify 💙
    `.trim()
  }

  // Método alternativo usando fetch para APIs de email como SendGrid, Mailgun, etc.
  async sendEmailWithAPI(clientEmail, clientName) {
    try {
      // Este es un ejemplo usando una API genérica
      // Puedes reemplazarlo con SendGrid, Mailgun, etc.
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: clientEmail,
          subject: '¡Bienvenido a Brify! 🎉 Agrega nuestro bot de Telegram',
          html: this.getWelcomeEmailHTML(clientName)
        })
      })

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor')
      }

      const result = await response.json()
      return { success: true, result }
    } catch (error) {
      console.error('Error enviando email con API:', error)
      return { success: false, error: error.message }
    }
  }

  // Template HTML para el correo
  getWelcomeEmailHTML(clientName) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Bienvenido a Brify!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .telegram-section { background: #0088cc; color: white; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; }
        .steps { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .step { margin: 10px 0; padding: 10px; border-left: 4px solid #667eea; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
        .emoji { font-size: 1.2em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><span class="emoji">🎉</span> ¡Bienvenido a Brify, ${clientName}! <span class="emoji">🎉</span></h1>
            <p>Tu plataforma de entrenamiento personalizado</p>
        </div>
        
        <div class="content">
            <p><span class="emoji">🚀</span> ¡Estamos emocionados de tenerte con nosotros!</p>
            
            <div class="telegram-section">
                <h2><span class="emoji">🤖</span> ¡Conecta con nuestro Bot de Telegram!</h2>
                <p><strong>@brifybeta_bot</strong></p>
                <p>Aquí podrás preguntar y ver todo el contenido que tiene tu entrenador disponible para ti</p>
            </div>
            
            <div class="steps">
                <h3><span class="emoji">✨</span> ¿Qué puedes hacer con nuestro bot?</h3>
                <div class="step"><span class="emoji">💬</span> Hacer preguntas sobre tu entrenamiento</div>
                <div class="step"><span class="emoji">📚</span> Acceder a contenido personalizado</div>
                <div class="step"><span class="emoji">💡</span> Recibir consejos de tu entrenador</div>
                <div class="step"><span class="emoji">🎯</span> Y mucho más...</div>
            </div>
            
            <div class="steps">
                <h3><span class="emoji">🔗</span> Para comenzar, simplemente:</h3>
                <div class="step">1. Abre Telegram</div>
                <div class="step">2. Busca: <strong>@brifybeta_bot</strong></div>
                <div class="step">3. Inicia una conversación</div>
                <div class="step">4. <span class="emoji">🌟</span> ¡Disfruta de tu experiencia personalizada!</div>
            </div>
            
            <p><span class="emoji">💪</span> ¡Esperamos que disfrutes de todo lo que tenemos preparado para ti!</p>
        </div>
        
        <div class="footer">
            <p>Saludos,<br><strong>El equipo de Brify</strong> <span class="emoji">💙</span></p>
        </div>
    </div>
</body>
</html>
    `.trim()
  }
}

// Crear instancia singleton
const emailService = new EmailService()

export default emailService

// Exportar también la clase para casos específicos
export { EmailService }