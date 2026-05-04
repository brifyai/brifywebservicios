const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function insertExtensionsData() {
  try {
    console.log('🚀 Insertando datos de ejemplo en extensiones...');
    
    // Datos de ejemplo para extensiones
    const extensionsData = [
      {
        id: '1',
        name: 'Extra Storage',
        name_es: 'Almacenamiento Extra',
        description: 'Additional 500MB storage space',
        description_es: 'Espacio adicional de 500MB de almacenamiento',
        price_usd: '1500.00',
        storage_bonus_bytes: 524288000, // 500MB
        disponible: true
      },
      {
        id: '2', 
        name: 'Premium Support',
        name_es: 'Soporte Premium',
        description: 'Priority customer support with 24/7 availability',
        description_es: 'Soporte prioritario al cliente con disponibilidad 24/7',
        price_usd: '2000.00',
        storage_bonus_bytes: 0,
        disponible: true
      },
      {
        id: '3',
        name: 'Advanced Analytics',
        name_es: 'Análisis Avanzado',
        description: 'Detailed analytics and reporting features',
        description_es: 'Funciones detalladas de análisis e informes',
        price_usd: '2500.00',
        storage_bonus_bytes: 0,
        disponible: true
      },
      {
        id: '4',
        name: 'API Access',
        name_es: 'Acceso API',
        description: 'Full API access for integrations',
        description_es: 'Acceso completo a API para integraciones',
        price_usd: '3000.00',
        storage_bonus_bytes: 0,
        disponible: false // Esta extensión no está disponible
      },
      {
        id: '5',
        name: 'Custom Branding',
        name_es: 'Marca Personalizada',
        description: 'Remove branding and add your own logo',
        description_es: 'Eliminar marca y agregar tu propio logo',
        price_usd: '1800.00',
        storage_bonus_bytes: 0,
        disponible: true
      }
    ];

    // Insertar extensiones
    const { data: insertedExtensions, error: extensionsError } = await supabase
      .from('extensiones')
      .upsert(extensionsData, { onConflict: 'id' })
      .select();

    if (extensionsError) {
      console.error('❌ Error insertando extensiones:', extensionsError);
      return;
    }

    console.log('✅ Extensiones insertadas exitosamente:', insertedExtensions.length);
    
    // Verificar que las extensiones se insertaron correctamente
    const { data: allExtensions, error: fetchError } = await supabase
      .from('extensiones')
      .select('*')
      .order('id');

    if (fetchError) {
      console.error('❌ Error obteniendo extensiones:', fetchError);
      return;
    }

    console.log('📋 Extensiones en la base de datos:');
    allExtensions.forEach(ext => {
      console.log(`  - ${ext.name_es}: $${ext.price_usd} (${ext.disponible ? 'Disponible' : 'No disponible'})`);
    });

    console.log('\n🎉 Sistema de extensiones configurado completamente!');
    console.log('\n📝 Próximos pasos:');
    console.log('1. Asegúrate de que las tablas extensiones y plan_extensiones estén creadas en Supabase');
    console.log('2. Ejecuta la aplicación para ver las extensiones en la interfaz');
    console.log('3. Las extensiones no disponibles aparecerán tachadas y deshabilitadas');
    
  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

// Ejecutar la función
insertExtensionsData();