const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function createExtensionsData() {
  try {
    console.log('🚀 Insertando datos de extensiones directamente...');
    
    // Insertar extensiones directamente usando insert
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

    // Verificar si la tabla existe
    const { data: tableCheck, error: tableError } = await supabase
      .from('extensiones')
      .select('count', { count: 'exact', head: true });

    if (tableError && tableError.code === '42P01') {
      console.log('❌ La tabla extensiones no existe.');
      console.log('📝 Necesitas ejecutar el SQL de setup_complete_extensions.sql en Supabase primero.');
      console.log('\n🔗 Pasos:');
      console.log('1. Ve al panel de Supabase');
      console.log('2. Abre el editor SQL');
      console.log('3. Copia y pega el contenido de setup_complete_extensions.sql');
      console.log('4. Ejecuta el script');
      console.log('5. Vuelve a ejecutar este script');
      return;
    }

    if (tableError) {
      console.error('❌ Error verificando tabla:', tableError);
      return;
    }

    console.log('✅ Tabla extensiones existe, insertando datos...');

    // Insertar datos
    const { data, error } = await supabase
      .from('extensiones')
      .upsert(extensionsData, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ Error insertando extensiones:', error);
      return;
    }

    console.log(`✅ ${data.length} extensiones insertadas exitosamente`);
    
    // Verificar datos insertados
    const { data: allExtensions, error: fetchError } = await supabase
      .from('extensiones')
      .select('*')
      .order('id');

    if (fetchError) {
      console.error('❌ Error obteniendo extensiones:', fetchError);
      return;
    }

    console.log('\n📋 Extensiones en la base de datos:');
    allExtensions.forEach(ext => {
      const status = ext.disponible ? '✅ Disponible' : '❌ No disponible';
      console.log(`  ${ext.id}. ${ext.name_es}: $${ext.price_usd} - ${status}`);
    });

    console.log('\n🎉 ¡Extensiones configuradas! Recarga la página para verlas.');
    
  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

createExtensionsData();