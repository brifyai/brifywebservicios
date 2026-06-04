const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Crear cliente de Supabase
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function checkSubcarpetas() {
  try {
    console.log('🔍 Verificando subcarpetas para seba.godoy.rubio@gmail.com...');
    
    // Verificar subcarpetas existentes
    const { data, error } = await supabase
      .from('sub_carpetas_administrador')
      .select('*')
      .eq('administrador_email', 'seba.godoy.rubio@gmail.com');
    
    if (error) {
      console.error('❌ Error consultando subcarpetas:', error);
      return;
    }
    
    console.log('📊 Subcarpetas encontradas:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('📁 Detalles de subcarpetas:');
      data.forEach((subcarpeta, index) => {
        console.log(`  ${index + 1}. ${subcarpeta.nombre_subcarpeta} (${subcarpeta.tipo_extension})`);
        console.log(`     ID: ${subcarpeta.file_id_subcarpeta}`);
        console.log(`     Master: ${subcarpeta.file_id_master}`);
        console.log(`     Creada: ${subcarpeta.created_at}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No se encontraron subcarpetas para este usuario.');
      console.log('💡 Esto explica por qué las opciones están bloqueadas en "Master - Brify (Raíz)"');
      console.log('🔧 Solución: Crear las subcarpetas necesarias en la base de datos.');
    }
    
  } catch (err) {
    console.error('💥 Error inesperado:', err);
  }
}

checkSubcarpetas();