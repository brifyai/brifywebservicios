// Servicio de email para envío de correos de bienvenida y post-compra
// Usando Gmail API directamente con tokens almacenados

class EmailService {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.isInitialized = false
  }



  // Obtener tokens almacenados desde Supabase para un usuario específico
  async getStoredTokens(userId = null) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.REACT_APP_SUPABASE_ANON_KEY
      )
      
      // Si no se proporciona userId, intentar obtener el usuario actual
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          userId = user.id
        } else {
          console.error('No se pudo obtener el usuario actual')
          return null
        }
      }
      
      const { data, error } = await supabase
        .from('user_credentials')
        .select('google_access_token, google_refresh_token')
        .eq('user_id', userId)
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

  // Inicializar Gmail API con tokens de usuario específico
  async init(userId = null) {
    try {
      if (this.isInitialized && this.accessToken) {
        return true
      }

      // Cargar Google API
      await this.loadGoogleAPI()
      
      // Inicializar Gmail API
      await new Promise((resolve, reject) => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest']
            })
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      })

      // Obtener tokens almacenados para el usuario
      const storedTokens = await this.getStoredTokens(userId)
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

  // Enviar correo de bienvenida para carpetas compartidas
  async sendWelcomeEmail(clientEmail, clientName, userId = null) {
    try {
      const initialized = await this.init(userId)
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
      const htmlContent = this.getWelcomeEmailHTML(clientName)
      
      // Crear el mensaje en formato RFC 2822 con HTML
      const email = [
        `To: ${clientEmail}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlContent
      ].join('\n')
      
      // Codificar en base64url
      const encodedMessage = btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      
      const response = await window.gapi.client.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedMessage
        }
      })

      console.log('Email de bienvenida enviado exitosamente:', response)
      return { success: true, messageId: response.result.id }
    } catch (error) {
      console.error('Error enviando email de bienvenida:', error)
      return { success: false, error: error.message }
    }
  }

  // Enviar correo de bienvenida post-compra desde la cuenta oficial de Brify
  async sendPostPurchaseWelcomeEmail(clientEmail, clientName, planName) {
    try {
      // Usar la cuenta autenticada actual (que debe ser brifyaimaster@gmail.com)
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
        throw new Error('No se encontró un token de acceso válido para cuenta oficial')
      }
      
      const subject = `🎉 ¡Bienvenido a Brify! Tu plan ${planName} está activo`
      const htmlContent = this.getPostPurchaseWelcomeEmailHTML(clientName, planName)
      
      // Codificar el asunto en UTF-8 usando RFC 2047
      const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
      
      // Crear el mensaje en formato RFC 2822 con HTML y remitente oficial
      const email = [
        `From: Equipo Brify <brifyaimaster@gmail.com>`,
        `To: ${clientEmail}`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlContent
      ].join('\n')
      
      // Codificar en base64url
      const encodedMessage = btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      
      const response = await window.gapi.client.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedMessage
        }
      })

      console.log('Email post-compra enviado exitosamente:', response)
      return { success: true, messageId: response.result.id }
    } catch (error) {
      console.error('Error enviando email post-compra:', error)
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

  // Template HTML para el correo de bienvenida (carpetas compartidas)
  getWelcomeEmailHTML(clientName) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Bienvenido a Brify!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; color: #000000; }
        .telegram-section { background: #0088cc; color: white; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; }
        .steps { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; color: #000000; }
        .step { margin: 10px 0; padding: 10px; border-left: 4px solid #667eea; color: #000000; }
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

  // Template HTML para el correo post-compra con todas las funcionalidades
  getPostPurchaseWelcomeEmailHTML(clientName, planName) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Bienvenido a Brify!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; color: #000000; }
        .success-badge { background: #10b981; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin: 20px 0; font-weight: bold; }
        .feature-section { background: white; padding: 25px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #667eea; color: #000000; }
        .feature-title { color: #667eea; font-size: 1.3em; font-weight: bold; margin-bottom: 15px; }
        .feature-list { list-style: none; padding: 0; }
        .feature-item { margin: 10px 0; padding: 10px; background: #f8fafc; border-radius: 5px; border-left: 3px solid #667eea; color: #000000; }
        .telegram-section { background: linear-gradient(135deg, #0088cc 0%, #0066aa 100%); color: white; padding: 25px; border-radius: 10px; margin: 20px 0; text-align: center; }
        .ai-section { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 25px; border-radius: 10px; margin: 20px 0; }
        .routine-section { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 25px; border-radius: 10px; margin: 20px 0; }
        .folders-section { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; border-radius: 10px; margin: 20px 0; }
        .cta-button { background: #667eea; color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; display: inline-block; margin: 10px 5px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
        .emoji { font-size: 1.2em; }
        .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 3px; color: #000000; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><span class="emoji">🎉</span> ¡Bienvenido a Brify, ${clientName}! <span class="emoji">🎉</span></h1>
            <p>Tu plataforma de entrenamiento e inteligencia artificial</p>
            <div class="success-badge">
                <span class="emoji">✅</span> Plan ${planName} Activado Exitosamente
            </div>
        </div>
        
        <div class="content">
            <p style="font-size: 1.1em; text-align: center; margin-bottom: 30px;">
                <span class="emoji">🚀</span> <strong>¡Tu compra fue realizada exitosamente!</strong> <span class="emoji">🚀</span><br>
                <span class="highlight">Revisa este correo de bienvenida para conocer todas las funcionalidades disponibles.</span>
            </p>
            
            <!-- Gestión de Carpetas -->
            <div class="folders-section">
                <h2><span class="emoji">📁</span> Gestión de Carpetas</h2>
                <ul class="feature-list">
                    <li class="feature-item">✨ <strong>Crear carpetas:</strong> Se recomienda que el nombre de la carpeta sea un correo, ya que esto generará un correo de invitación y bienvenida automático</li>
                    <li class="feature-item">📤 <strong>Subir contenido:</strong> Sube archivos, documentos, videos y más a las carpetas creadas</li>
                    <li class="feature-item">🔗 <strong>Compartir fácilmente:</strong> Invita a clientes y colaboradores de forma automática</li>
                    <li class="feature-item">📊 <strong>Organización eficiente:</strong> Mantén todo tu contenido organizado y accesible</li>
                </ul>
            </div>
            
            <!-- Inteligencia Artificial -->
            <div class="ai-section">
                <h2><span class="emoji">🤖</span> Inteligencia Artificial</h2>
                <ul class="feature-list">
                    <li class="feature-item">🔍 <strong>Búsqueda Semántica:</strong> Busca contenido en la web usando IA avanzada</li>
                    <li class="feature-item">💬 <strong>Chat IA:</strong> Conversa con inteligencia artificial personalizada</li>
                    <li class="feature-item">📚 <strong>Análisis inteligente:</strong> La IA analiza tu contenido para brindarte respuestas precisas</li>
                    <li class="feature-item">🎯 <strong>Respuestas contextuales:</strong> Obtén información relevante basada en tus documentos</li>
                </ul>
            </div>
            
            <!-- Rutinas Personalizadas -->
            <div class="routine-section">
                <h2><span class="emoji">📋</span> Rutinas Personalizadas</h2>
                <ul class="feature-list">
                    <li class="feature-item">📥 <strong>Descarga la plantilla:</strong> Utiliza nuestra plantilla Excel rutinap.xlsx</li>
                    <li class="feature-item">⏰ <strong>Recordatorios diarios:</strong> Recibe recordatorios de tu rutina y dieta todas las mañanas</li>
                    <li class="feature-item">❓ <strong>Consultas específicas:</strong> Haz preguntas sobre tu rutina y dieta</li>
                    <li class="feature-item">📈 <strong>Seguimiento personalizado:</strong> Mantén un control detallado de tu progreso</li>
                </ul>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="${window.location.origin}/rutinap.xlsx" class="cta-button">
                        <span class="emoji">📥</span> Descargar Plantilla Excel
                    </a>
                </div>
            </div>
            
            <!-- Telegram Bot -->
            <div class="telegram-section">
                <h2><span class="emoji">📱</span> Bot de Telegram @brifybeta_bot</h2>
                <p style="font-size: 1.1em; margin-bottom: 20px;">Desde Telegram podrás acceder a todas las funcionalidades:</p>
                <ul class="feature-list">
                    <li class="feature-item">📁 <strong>Crear carpetas:</strong> Gestiona tus carpetas directamente desde Telegram</li>
                    <li class="feature-item">📤 <strong>Subir archivos:</strong> Envía documentos, imágenes y videos al bot</li>
                    <li class="feature-item">📋 <strong>Listar carpetas/archivos:</strong> Ve todo tu contenido organizado</li>
                    <li class="feature-item">💬 <strong>Conversación general:</strong> Chatea con IA sobre cualquier tema</li>
                    <li class="feature-item">🔍 <strong>Búsquedas inteligentes:</strong> Encuentra información en tus documentos</li>
                </ul>
                
                <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin-top: 20px;">
                    <h3><span class="emoji">🚀</span> Para comenzar:</h3>
                    <ol style="text-align: left; margin: 0; padding-left: 20px;">
                        <li>Abre Telegram</li>
                        <li>Busca: <strong>@brifybeta_bot</strong></li>
                        <li>Inicia una conversación</li>
                        <li>¡Disfruta de todas las funcionalidades!</li>
                    </ol>
                </div>
            </div>
            
            <div style="background: white; padding: 25px; border-radius: 10px; text-align: center; margin: 30px 0;">
                <h3 style="color: #667eea; margin-bottom: 20px;">
                    <span class="emoji">🌟</span> ¡Todo está listo para que comiences!
                </h3>
                <p style="font-size: 1.1em; color: #666; margin-bottom: 20px;">
                    Tu plan <strong>${planName}</strong> te da acceso completo a todas estas funcionalidades.
                </p>
                <a href="${window.location.origin}/dashboard" class="cta-button">
                    <span class="emoji">🚀</span> Ir al Dashboard
                </a>
                <a href="https://t.me/brifybeta_bot" class="cta-button">
                    <span class="emoji">📱</span> Abrir Bot de Telegram
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p><span class="emoji">💙</span> Gracias por confiar en nosotros</p>
            <p><strong>El equipo de Brify</strong></p>
            <p style="font-size: 0.9em; color: #999;">Si tienes alguna pregunta, no dudes en contactarnos</p>
        </div>
    </div>
</body>
</html>
    `.trim()
  }

  // Generar mensaje de bienvenida post-compra en texto plano
  getPostPurchaseWelcomeMessage(clientName, planName) {
    return `
¡Hola ${clientName}! 🎉

¡COMPRA REALIZADA EXITOSAMENTE! ✅
Tu plan ${planName} está ahora activo.

🚀 ¡Bienvenido a Brify! Tu plataforma completa de entrenamiento e inteligencia artificial.

📁 GESTIÓN DE CARPETAS:
• Crear carpetas (recomendamos usar correos como nombres para invitaciones automáticas)
• Subir contenido a las carpetas creadas
• Compartir fácilmente con clientes
• Organización eficiente de archivos

🤖 INTELIGENCIA ARTIFICIAL:
• Búsqueda Semántica en la web con IA
• Chat IA personalizado
• Análisis inteligente de contenido
• Respuestas contextuales basadas en tus documentos

📋 RUTINAS PERSONALIZADAS:
• Descarga la plantilla rutinap.xlsx desde la plataforma
• Recordatorios diarios de rutina y dieta todas las mañanas
• Consultas específicas sobre tu rutina
• Seguimiento personalizado de progreso

📱 BOT DE TELEGRAM (@brifybeta_bot):
Desde Telegram podrás:
• Crear carpetas
• Subir archivos
• Listar carpetas/archivos
• Conversación general con IA
• Búsquedas inteligentes

🔗 Para comenzar con Telegram:
1. Abre Telegram
2. Busca: @brifybeta_bot
3. Inicia una conversación
4. ¡Disfruta de todas las funcionalidades!

🌟 ¡Todo está listo para que comiences!
Tu plan ${planName} te da acceso completo a todas estas funcionalidades.

💙 Gracias por confiar en nosotros.

Saludos,
El equipo de Brify
    `.trim()
  }
}

// Crear instancia singleton
const emailService = new EmailService()

export default emailService

// Exportar también la clase para casos específicos
export { EmailService }