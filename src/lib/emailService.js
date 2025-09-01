// Servicio de email para envío de correos de bienvenida
// Usando Gmail API directamente con tokens almacenados

class EmailService {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.isInitialized = false
  }

  // Obtener tokens almacenados desde Supabase
  async getStoredTokens() {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.REACT_APP_SUPABASE_ANON_KEY
      )
      
      const { data, error } = await supabase
        .from('user_credentials')
        .select('google_access_token, google_refresh_token')
        .eq('user_id', 'admin') // Asumiendo que el admin tiene ID 'admin'
        .single()
      
      if (error) {
        console.error('Error obteniendo tokens:', error)
        return null
      }
      
      return {
        accessToken: data.google_access_token,
        refreshToken: data.google_refresh_token
      }
    } catch (error) {
      console.error('Error conectando a Supabase:', error)
      return null
    }
  }

  // Inicializar Gmail API
  async init() {
    try {
      if (this.isInitialized) {
        return true
      }

      // Cargar Google API
      await this.loadGoogleAPI()
      
      // Inicializar Gmail API
      await window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest']
        })
      })

      // Verificar si hay autenticación activa
      if (window.gapi && window.gapi.auth2) {
        const authInstance = window.gapi.auth2.getAuthInstance()
        if (authInstance && authInstance.isSignedIn.get()) {
          const user = authInstance.currentUser.get()
          const authResponse = user.getAuthResponse()
          this.accessToken = authResponse.access_token
          this.isInitialized = true
          return true
        }
      }

      // Si no hay autenticación activa, intentar usar tokens almacenados
      const storedTokens = await this.getStoredTokens()
      if (storedTokens && storedTokens.accessToken) {
        this.accessToken = storedTokens.accessToken
        this.refreshToken = storedTokens.refreshToken
        this.isInitialized = true
        return true
      }

      console.warn('No se encontraron tokens válidos para Gmail API')
      return false
    } catch (error) {
      console.error('Error inicializando Gmail API:', error)
      throw error
    }
  }

  // Cargar Google API dinámicamente
  async loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google API'))
      document.head.appendChild(script)
    })
  }

  // Enviar correo de bienvenida
  async sendWelcomeEmail(clientEmail, clientName) {
    try {
      const initialized = await this.init()
      if (!initialized) {
        throw new Error('No se pudo inicializar Gmail API')
      }

      // Configurar el token de acceso
      if (this.accessToken) {
        window.gapi.client.setToken({
          access_token: this.accessToken
        })
      } else {
        throw new Error('No se encontró un token de acceso válido')
      }
      
      const subject = `¡Bienvenido a Brify, ${clientName}!`
      const message = this.getWelcomeMessage(clientName)
      
      // Crear el mensaje en formato RFC 2822
      const email = [
        `To: ${clientEmail}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        message
      ].join('\n')
      
      // Codificar en base64url
      const encodedMessage = btoa(email)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      
      const response = await window.gapi.client.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedMessage
        }
      })

      console.log('Email enviado exitosamente:', response)
      return { success: true, messageId: response.result.id }
    } catch (error) {
      console.error('Error enviando email de bienvenida:', error)
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