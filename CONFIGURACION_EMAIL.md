# Configuración del Servicio de Email para Correos de Bienvenida

## Funcionalidad Implementada

Se ha implementado un sistema de envío de correos de bienvenida automático que se ejecuta cuando se crea una nueva carpeta para un cliente. El correo incluye:

- 🎉 Mensaje de bienvenida personalizado
- 🤖 Invitación a agregar el bot de Telegram `@brifybeta_bot`
- ✨ Explicación de las funcionalidades disponibles
- 🔗 Instrucciones paso a paso para comenzar
- 💙 Diseño atractivo con emojis y formato HTML

## Configuración de EmailJS (Recomendado)

### Paso 1: Crear cuenta en EmailJS
1. Ve a [https://www.emailjs.com/](https://www.emailjs.com/)
2. Crea una cuenta gratuita
3. Verifica tu email

### Paso 2: Configurar servicio de email
1. En el dashboard de EmailJS, ve a "Email Services"
2. Haz clic en "Add New Service"
3. Selecciona tu proveedor de email (Gmail, Outlook, etc.)
4. Sigue las instrucciones para conectar tu cuenta
5. Copia el **Service ID** generado

### Paso 3: Crear template de email
1. Ve a "Email Templates"
2. Haz clic en "Create New Template"
3. Configura el template con estos campos:
   - **To Email**: `{{to_email}}`
   - **From Name**: `{{from_name}}`
   - **To Name**: `{{to_name}}`
   - **Subject**: `¡Bienvenido a Brify! 🎉 Agrega nuestro bot de Telegram`
   - **Content**: `{{message}}`
4. Copia el **Template ID** generado

### Paso 4: Obtener Public Key
1. Ve a "Account" > "General"
2. Copia tu **Public Key**

### Paso 5: Actualizar configuración en el código
Edita el archivo `src/lib/emailService.js` y actualiza estas líneas:

```javascript
this.serviceId = 'tu_service_id_aqui' // Reemplazar con tu Service ID
this.templateId = 'tu_template_id_aqui' // Reemplazar con tu Template ID
this.publicKey = 'tu_public_key_aqui' // Reemplazar con tu Public Key
```

## Configuración Alternativa con API Backend

Si prefieres usar un servicio de email con API backend (SendGrid, Mailgun, etc.), puedes:

1. Crear un endpoint `/api/send-email` en tu backend
2. Usar el método `sendEmailWithAPI()` en lugar de `sendWelcomeEmail()`
3. Configurar las credenciales del servicio en tu backend

## Funcionalidades del Sistema

### Cuándo se envía el correo
- ✅ Al crear una nueva carpeta para un cliente
- ✅ Tanto para usuarios nuevos como existentes
- ✅ Incluye manejo de errores sin afectar la creación de carpetas

### Contenido del correo
- **Saludo personalizado** con el nombre extraído del email
- **Información del bot** `@brifybeta_bot`
- **Instrucciones claras** para agregar el bot
- **Diseño responsive** con HTML y CSS
- **Emojis** para hacer el mensaje más atractivo

### Manejo de errores
- Si falla el envío del correo, la carpeta se crea normalmente
- Se muestran mensajes informativos al usuario
- Los errores se registran en la consola para debugging

## Mensajes de Confirmación

### Éxito completo
```
"Carpeta creada, usuario registrado y correo de bienvenida enviado a [email]"
```

### Éxito parcial
```
"Carpeta creada y usuario registrado. Error enviando correo de bienvenida."
```

### Usuario existente
```
"Carpeta creada y correo de bienvenida enviado a [email]"
```

## Personalización del Mensaje

Puedes personalizar el mensaje editando el método `getWelcomeMessage()` en `src/lib/emailService.js`:

```javascript
getWelcomeMessage(clientName) {
  return `
¡Hola ${clientName}! 🎉

// Tu mensaje personalizado aquí...
  `.trim()
}
```

## Solución de Problemas

### El correo no se envía
1. Verifica que las credenciales de EmailJS sean correctas
2. Revisa la consola del navegador para errores
3. Asegúrate de que el dominio esté autorizado en EmailJS

### El correo llega a spam
1. Configura SPF, DKIM y DMARC en tu dominio
2. Usa un email verificado como remitente
3. Evita palabras que activen filtros de spam

### Límites de EmailJS
- Plan gratuito: 200 emails/mes
- Para mayor volumen, considera un plan pago o API backend

## Archivos Modificados

- ✅ `src/lib/emailService.js` - Servicio de email creado
- ✅ `src/components/folders/Folders.js` - Integración del envío de correos
- ✅ `CONFIGURACION_EMAIL.md` - Esta documentación

## Próximos Pasos

1. Configurar EmailJS con tus credenciales
2. Probar la funcionalidad creando una carpeta
3. Verificar que el correo llegue correctamente
4. Personalizar el mensaje según tus necesidades

¡El sistema está listo para enviar correos de bienvenida automáticamente! 🚀