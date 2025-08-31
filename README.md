# Webrify - Plataforma de Servicios Web con IA

Plataforma web que integra Google Drive, autenticación de usuarios, embeddings de IA y servicios de pago con Mercado Pago.

## Características

- 🔐 Autenticación de usuarios con Supabase
- 📁 Integración con Google Drive API
- 🤖 Chat con IA usando Groq API
- 🔍 Búsqueda semántica con embeddings
- 💳 Integración con Mercado Pago
- 📊 Dashboard de usuario
- 🔄 Workflow de n8n para automatización

## Configuración para Despliegue en Vercel

### Variables de Entorno Requeridas

Configura las siguientes variables de entorno en Vercel:

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=tu_url_de_supabase
REACT_APP_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase

# Google Drive API Configuration
REACT_APP_GOOGLE_CLIENT_ID=tu_google_client_id
REACT_APP_GOOGLE_CLIENT_SECRET=tu_google_client_secret
REACT_APP_GOOGLE_REDIRECT_URI=https://tu-dominio.vercel.app/auth/google/callback

# Gemini API Configuration (for embeddings)
REACT_APP_GEMINI_API_KEY=tu_gemini_api_key

# Groq API Configuration
REACT_APP_GROQ_API_KEY=tu_groq_api_key

# Mercado Pago Configuration
REACT_APP_MERCADO_PAGO_PUBLIC_KEY=tu_mercadopago_public_key
REACT_APP_MERCADO_PAGO_ACCESS_TOKEN=tu_mercadopago_access_token
```

### Pasos para Desplegar en Vercel

1. **Conectar Repositorio**
   - Ve a [Vercel Dashboard](https://vercel.com/dashboard)
   - Haz clic en "New Project"
   - Conecta este repositorio de GitHub

2. **Configurar Variables de Entorno**
   - En la configuración del proyecto en Vercel
   - Ve a "Environment Variables"
   - Agrega todas las variables listadas arriba

3. **Configurar Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`

4. **Configurar Google OAuth**
   - En Google Cloud Console, agrega tu dominio de Vercel a los orígenes autorizados
   - Actualiza la URI de redirección: `https://tu-dominio.vercel.app/auth/google/callback`

### Base de Datos (Supabase)

Ejecuta las migraciones SQL en tu instancia de Supabase:

1. `migrations/add_google_access_token_field.sql`
2. `migrations/add_registro_previo_column.sql`
3. `migrations/add_unique_constraint_user_credentials.sql`
4. `migrations/add_unique_constraint_user_tokens_usage.sql`
5. `migrations/add_unique_constraint_users.sql`
6. `rls_policies.sql`

### Workflow de n8n (Opcional)

Si deseas usar el workflow de n8n para automatización:

1. Importa `n8n_google_drive_dynamic_user.json` en tu instancia de n8n
2. Configura las credenciales de Google Drive y Supabase
3. Ejecuta el script `import_n8n_workflow.sh` (adaptado para tu entorno)

## Desarrollo Local

1. Clona el repositorio
2. Copia `.env.example` a `.env.local`
3. Configura las variables de entorno
4. Ejecuta:

```bash
npm install
npm start
```

## Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── auth/           # Autenticación
│   ├── dashboard/      # Dashboard principal
│   ├── embeddings/     # IA y búsqueda semántica
│   ├── files/          # Gestión de archivos
│   └── folders/        # Gestión de carpetas
├── lib/                # Librerías y servicios
├── services/           # Servicios externos
└── contexts/           # Contextos de React
```

## Tecnologías Utilizadas

- **Frontend**: React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth + Google OAuth
- **Almacenamiento**: Google Drive API
- **IA**: Groq API, Google Gemini
- **Pagos**: Mercado Pago
- **Automatización**: n8n workflows

## Soporte

Para soporte técnico o preguntas sobre la implementación, contacta al equipo de desarrollo.