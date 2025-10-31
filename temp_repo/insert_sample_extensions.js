const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY
)

const sampleExtensions = [
  {
    name_es: 'Almacenamiento Extra',
    name_en: 'Extra Storage',
    description_es: 'Añade 5GB adicionales de almacenamiento',
    description_en: 'Add 5GB additional storage',
    price_usd: 10.00,
    disponible: true
  },
  {
    name_es: 'Análisis Avanzado',
    name_en: 'Advanced Analytics',
    description_es: 'Reportes detallados y métricas avanzadas',
    description_en: 'Detailed reports and advanced metrics',
    price_usd: 15.00,
    disponible: true
  },
  {
    name_es: 'Soporte Prioritario',
    name_en: 'Priority Support',
    description_es: 'Soporte técnico 24/7 con respuesta prioritaria',
    description_en: '24/7 technical support with priority response',
    price_usd: 20.00,
    disponible: true
  },
  {
    name_es: 'API Premium',
    name_en: 'Premium API',
    description_es: 'Acceso completo a todas las funciones de la API',
    description_en: 'Full access to all API features',
    price_usd: 25.00,
    disponible: false
  }
]

async function insertExtensions() {
  try {
    console.log('🔄 Insertando extensiones de ejemplo...')
    
    // Primero verificar si ya existen extensiones
    const { data: existingExtensions, error: checkError } = await supabase
      .from('extensiones')
      .select('*')
    
    if (checkError) {
      console.error('❌ Error verificando extensiones existentes:', checkError)
      return
    }
    
    if (existingExtensions && existingExtensions.length > 0) {
      console.log('ℹ️ Ya existen extensiones en la base de datos:')
      existingExtensions.forEach(ext => {
        console.log(`  - ${ext.name_es}: $${ext.price_usd} (${ext.disponible ? 'Disponible' : 'No disponible'})`)
      })
      return
    }
    
    // Insertar extensiones de ejemplo
    const { data, error } = await supabase
      .from('extensiones')
      .insert(sampleExtensions)
      .select()
    
    if (error) {
      console.error('❌ Error insertando extensiones:', error)
      return
    }
    
    console.log('✅ Extensiones insertadas exitosamente:')
    data.forEach(ext => {
      console.log(`  - ${ext.name_es}: $${ext.price_usd} (${ext.disponible ? 'Disponible' : 'No disponible'})`)
    })
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

insertExtensions()
  .then(() => {
    console.log('🏁 Proceso completado')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Error fatal:', error)
    process.exit(1)
  })