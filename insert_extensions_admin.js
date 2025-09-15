const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Usar la clave de servicio para bypasear RLS
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function insertExtensionsAsAdmin() {
  try {
    console.log('🚀 Insertando extensiones como administrador...');
    
    const extensionsData = [
      {
        id: '1',
        name: 'Extra Storage',
        name_es: 'Almacenamiento Extra',
        description: 'Additional 500MB storage space',
        description_es: 'Espacio adicional de 500MB de almacenamiento',
        price_usd: 1500.00,
        storage_bonus_bytes: 524288000,
        disponible: true
      },
      {
        id: '2',
        name: 'Premium Support',
        name_es: 'Soporte Premium',
        description: 'Priority customer support with 24/7 availability',
        description_es: 'Soporte prioritario al cliente con disponibilidad 24/7',
        price_usd: 2000.00,
        storage_bonus_bytes: 0,
        disponible: true
      },
      {
        id: '3',
        name: 'Advanced Analytics',
        name_es: 'Análisis Avanzado',
        description: 'Detailed analytics and reporting features',
        description_es: 'Funciones detalladas de análisis e informes',
        price_usd: 2500.00,
        storage_bonus_bytes: 0,
        disponible: true
      },
      {
        id: '4',
        name: 'API Access',
        name_es: 'Acceso API',
        description: 'Full API access for integrations',
        description_es: 'Acceso completo a API para integraciones',
        price_usd: 3000.00,
        storage_bonus_bytes: 0,
        disponible: false
      },
      {
        id: '5',
        name: 'Custom Branding',
        name_es: 'Marca Personalizada',
        description: 'Remove branding and add your own logo',
        description_es: 'Eliminar marca y agregar tu propio logo',
        price_usd: 1800.00,
        storage_bonus_bytes: 0,
        disponible: true
      }
    ];

    // Insertar cada extensión individualmente
    for (const extension of extensionsData) {
      console.log(`📝 Insertando: ${extension.name_es}...`);
      
      const { data, error } = await supabase
        .from('extensiones')
        .upsert(extension, { onConflict: 'id' })
        .select();

      if (error) {
        console.error(`❌ Error con ${extension.name_es}:`, error.message);
      } else {
        console.log(`✅ ${extension.name_es} insertada correctamente`);
      }
    }

    // Verificar todas las extensiones
    const { data: allExtensions, error: fetchError } = await supabase
      .from('extensiones')
      .select('*')
      .order('id');

    if (fetchError) {
      console.error('❌ Error obteniendo extensiones:', fetchError);
      return;
    }

    console.log('\n📋 Extensiones en la base de datos:');
    if (allExtensions && allExtensions.length > 0) {
      allExtensions.forEach(ext => {
        const status = ext.disponible ? '✅ Disponible' : '❌ No disponible';
        console.log(`  ${ext.id}. ${ext.name_es}: $${ext.price_usd} - ${status}`);
      });
      console.log('\n🎉 ¡Extensiones configuradas! Recarga la página para verlas.');
    } else {
      console.log('⚠️ No se encontraron extensiones en la base de datos.');
      console.log('\n📝 Asegúrate de que:');
      console.log('1. La tabla extensiones existe en Supabase');
      console.log('2. Las políticas RLS permiten la inserción');
      console.log('3. Tienes la clave de servicio configurada');
    }
    
  } catch (error) {
    console.error('💥 Error general:', error);
    console.log('\n🔧 Soluciones posibles:');
    console.log('1. Ejecutar el SQL de setup_complete_extensions.sql en Supabase');
    console.log('2. Verificar que las variables de entorno estén configuradas');
    console.log('3. Asegurar que la tabla extensiones tenga las políticas RLS correctas');
  }
}

insertExtensionsAsAdmin();