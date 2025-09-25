const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
)

async function migratePricesToCLP() {
  try {
    console.log('🔄 Iniciando migración de precios de USD a CLP...')
    console.log('💱 Tasa de cambio utilizada: 1 USD = 950 CLP')
    
    // Ejecutar migración manual directamente
    await manualMigration()
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

async function manualMigration() {
  try {
    console.log('\n📦 Migración manual de extensiones...')
    
    // 1. Obtener todas las extensiones actuales
    const { data: extensiones, error: fetchError } = await supabase
      .from('extensiones')
      .select('id, name_es, price_usd')
    
    if (fetchError) {
      console.error('❌ Error obteniendo extensiones:', fetchError)
      return
    }
    
    console.log(`📋 Encontradas ${extensiones.length} extensiones para convertir`)
    
    // 2. Convertir cada extensión individualmente
    console.log('💱 Convirtiendo precios de USD a CLP...')
    
    for (const extension of extensiones) {
      const priceUSD = parseFloat(extension.price_usd || 0)
      const priceCLP = Math.round(priceUSD * 950)
      
      console.log(`  - ${extension.name_es}: $${priceUSD} USD → $${priceCLP.toLocaleString()} CLP`)
      
      // Actualizar el precio en la base de datos
      const { error: updateError } = await supabase
        .from('extensiones')
        .update({ 
          price_usd: priceCLP  // Guardamos el valor en CLP en el campo price_usd
        })
        .eq('id', extension.id)
      
      if (updateError) {
        console.error(`❌ Error actualizando extensión ${extension.name_es}:`, updateError)
      }
    }
    
    // 3. Verificar conversión
    await verifyMigration()
    
    console.log('\n✅ ¡Migración completada!')
    console.log('💡 Los precios ahora están en pesos chilenos (CLP)')
    console.log('🔄 Nota: Los valores están guardados en el campo price_usd pero ahora representan CLP')
    
  } catch (error) {
    console.error('❌ Error en migración manual:', error)
  }
}

async function verifyMigration() {
  try {
    console.log('\n🔍 Verificando migración...')
    
    // Verificar los precios actuales
    const { data: extensions, error } = await supabase
      .from('extensiones')
      .select('id, name_es, price_usd')
      .limit(5)
    
    if (error) {
      console.error('❌ Error verificando:', error)
      return
    }
    
    console.log('\n📊 Muestra de precios después de la migración:')
    extensions.forEach(ext => {
      const priceCLP = ext.price_usd || 0
      console.log(`  - ${ext.name_es}: $${parseInt(priceCLP).toLocaleString()} CLP`)
    })
    
  } catch (error) {
    console.error('❌ Error verificando migración:', error)
  }
}

// Ejecutar la migración
migratePricesToCLP()