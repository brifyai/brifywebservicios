const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function setupExtensiones() {
  try {
    console.log('🚀 Iniciando configuración del sistema de extensiones...');
    
    // Crear tabla extensiones
    console.log('📋 Creando tabla extensiones...');
    const createExtensionesQuery = `
      CREATE TABLE IF NOT EXISTS extensiones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        name_es VARCHAR(255) NOT NULL,
        description TEXT,
        description_es TEXT,
        price_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        extension_code VARCHAR(100) UNIQUE NOT NULL,
        service_type VARCHAR(50) NOT NULL DEFAULT 'entrenador',
        disponible BOOLEAN NOT NULL DEFAULT true,
        storage_extra_bytes BIGINT DEFAULT 0,
        token_extra_usage INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const { error: extError } = await supabase.rpc('exec', { sql: createExtensionesQuery });
    if (extError) {
      console.error('❌ Error creando tabla extensiones:', extError);
    } else {
      console.log('✅ Tabla extensiones creada exitosamente');
    }
    
    // Crear tabla plan_extensiones
    console.log('📋 Creando tabla plan_extensiones...');
    const createPlanExtensionesQuery = `
      CREATE TABLE IF NOT EXISTS plan_extensiones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        plan_id UUID NOT NULL,
        extension_id UUID NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, plan_id, extension_id)
      );
    `;
    
    const { error: planExtError } = await supabase.rpc('exec', { sql: createPlanExtensionesQuery });
    if (planExtError) {
      console.error('❌ Error creando tabla plan_extensiones:', planExtError);
    } else {
      console.log('✅ Tabla plan_extensiones creada exitosamente');
    }
    
    // Insertar datos de ejemplo
    console.log('📝 Insertando extensiones de ejemplo...');
    const extensionesData = [
      {
        name: 'Extra Storage 1GB',
        name_es: 'Almacenamiento Extra 1GB',
        description: 'Additional 1GB of storage space',
        description_es: 'Espacio adicional de almacenamiento de 1GB',
        price_usd: 10.00,
        extension_code: 'storage_1gb',
        service_type: 'entrenador',
        disponible: true,
        storage_extra_bytes: 1073741824,
        token_extra_usage: 0
      },
      {
        name: 'Extra Storage 5GB',
        name_es: 'Almacenamiento Extra 5GB',
        description: 'Additional 5GB of storage space',
        description_es: 'Espacio adicional de almacenamiento de 5GB',
        price_usd: 40.00,
        extension_code: 'storage_5gb',
        service_type: 'entrenador',
        disponible: true,
        storage_extra_bytes: 5368709120,
        token_extra_usage: 0
      },
      {
        name: 'Premium Tokens',
        name_es: 'Tokens Premium',
        description: 'Additional 1M tokens for AI processing',
        description_es: 'Tokens adicionales de 1M para procesamiento IA',
        price_usd: 25.00,
        extension_code: 'tokens_1m',
        service_type: 'entrenador',
        disponible: true,
        storage_extra_bytes: 0,
        token_extra_usage: 1000000
      },
      {
        name: 'Advanced Analytics',
        name_es: 'Analíticas Avanzadas',
        description: 'Advanced analytics and reporting features',
        description_es: 'Funciones avanzadas de analíticas e informes',
        price_usd: 15.00,
        extension_code: 'analytics_advanced',
        service_type: 'entrenador',
        disponible: true,
        storage_extra_bytes: 0,
        token_extra_usage: 0
      },
      {
        name: 'Priority Support',
        name_es: 'Soporte Prioritario',
        description: '24/7 priority customer support',
        description_es: 'Soporte al cliente prioritario 24/7',
        price_usd: 20.00,
        extension_code: 'support_priority',
        service_type: 'entrenador',
        disponible: true,
        storage_extra_bytes: 0,
        token_extra_usage: 0
      },
      {
        name: 'API Access',
        name_es: 'Acceso API',
        description: 'Full API access for integrations',
        description_es: 'Acceso completo a API para integraciones',
        price_usd: 30.00,
        extension_code: 'api_access',
        service_type: 'entrenador',
        disponible: false,
        storage_extra_bytes: 0,
        token_extra_usage: 0
      },
      {
        name: 'Custom Branding',
        name_es: 'Marca Personalizada',
        description: 'Custom branding and white-label options',
        description_es: 'Opciones de marca personalizada y etiqueta blanca',
        price_usd: 50.00,
        extension_code: 'custom_branding',
        service_type: 'entrenador',
        disponible: true,
        storage_extra_bytes: 0,
        token_extra_usage: 0
      },
      {
        name: 'Multi-User Access',
        name_es: 'Acceso Multi-Usuario',
        description: 'Support for up to 10 team members',
        description_es: 'Soporte para hasta 10 miembros del equipo',
        price_usd: 35.00,
        extension_code: 'multi_user_10',
        service_type: 'entrenador',
        disponible: true,
        storage_extra_bytes: 0,
        token_extra_usage: 0
      }
    ];
    
    const { data: insertData, error: insertError } = await supabase
      .from('extensiones')
      .insert(extensionesData)
      .select();
    
    if (insertError) {
      console.error('❌ Error insertando extensiones:', insertError);
    } else {
      console.log(`✅ ${insertData.length} extensiones insertadas exitosamente`);
    }
    
    console.log('🎉 Sistema de extensiones configurado completamente!');
    
  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

setupExtensiones();