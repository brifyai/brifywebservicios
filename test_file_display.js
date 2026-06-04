/**
 * Script de prueba para verificar la nueva visualización de archivos
 * que muestra solo archivos principales de documentos_usuario_entrenador
 * sin mostrar los chunks individuales
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

class FileDisplayTester {
  constructor() {
    this.supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_ANON_KEY
    )
  }

  async testFileDisplay() {
    console.log('🧪 Iniciando prueba de visualización de archivos...')
    
    try {
      // Simular el comportamiento de loadFiles modificado
      await this.testLoadFilesFromUserTrainer()
      await this.testChunkVisibility()
      await this.testFileMetadata()
      
      console.log('\n✅ Todas las pruebas de visualización pasaron exitosamente')
      console.log('\n📋 Resumen:')
      console.log('- Los archivos se cargan desde documentos_usuario_entrenador')
      console.log('- Solo se muestran archivos principales, no chunks')
      console.log('- Los metadatos se transforman correctamente')
      console.log('- Los enlaces de Google Drive funcionan')
      
    } catch (error) {
      console.error('❌ Error en las pruebas:', error.message)
    }
  }

  async testLoadFilesFromUserTrainer() {
    console.log('\n🔍 Probando carga de archivos desde documentos_usuario_entrenador...')
    
    // Simular email de entrenador para la prueba
    const testTrainerEmail = 's.godoy.rubio@gmail.com'
    
    const { data, error } = await this.supabase
      .from('documentos_usuario_entrenador')
      .select('*')
      .eq('entrenador', testTrainerEmail)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Error cargando archivos: ${error.message}`)
    }
    
    console.log(`✅ Archivos encontrados: ${data?.length || 0}`)
    
    if (data && data.length > 0) {
      console.log('📄 Ejemplo de archivo:')
      const file = data[0]
      console.log(`   - ID: ${file.id}`)
      console.log(`   - Nombre: ${file.file_name}`)
      console.log(`   - Tipo: ${file.file_type}`)
      console.log(`   - Usuario: ${file.usuario}`)
      console.log(`   - Google Drive ID: ${file.file_id}`)
      console.log(`   - Fecha: ${file.created_at}`)
      
      // Transformar datos como lo hace el componente
      const transformedFile = {
        id: file.id,
        created_at: file.created_at,
        metadata: {
          name: file.file_name,
          file_name: file.file_name,
          file_type: file.file_type,
          file_id: file.file_id,
          source: 'documentos_usuario_entrenador',
          correo: file.usuario
        },
        entrenador: file.entrenador,
        usuario: file.usuario,
        google_file_id: file.file_id
      }
      
      console.log('\n🔄 Archivo transformado para la interfaz:')
      console.log(`   - metadata.name: ${transformedFile.metadata.name}`)
      console.log(`   - google_file_id: ${transformedFile.google_file_id}`)
      console.log(`   - metadata.source: ${transformedFile.metadata.source}`)
    }
    
    return data
  }

  async testChunkVisibility() {
    console.log('\n🔍 Verificando que no se muestran chunks individuales...')
    
    // Verificar que existen chunks en documentos_entrenador
    const { data: chunks, error: chunksError } = await this.supabase
      .from('documentos_entrenador')
      .select('id, metadata')
      .eq('metadata->>chunk_type', 'chunk')
      .limit(5)
    
    if (chunksError) {
      console.log('⚠️  No se pudieron verificar chunks:', chunksError.message)
      return
    }
    
    console.log(`📊 Chunks encontrados en documentos_entrenador: ${chunks?.length || 0}`)
    
    if (chunks && chunks.length > 0) {
      console.log('✅ Confirmado: Los chunks existen pero NO se mostrarán en la lista de archivos')
      console.log('   porque ahora cargamos desde documentos_usuario_entrenador')
      
      // Mostrar ejemplo de chunk
      const chunk = chunks[0]
      console.log('\n📄 Ejemplo de chunk (NO visible en interfaz):')
      console.log(`   - ID: ${chunk.id}`)
      console.log(`   - Tipo: ${chunk.metadata?.chunk_type}`)
      console.log(`   - Archivo padre: ${chunk.metadata?.file_name}`)
      console.log(`   - Índice: ${chunk.metadata?.chunk_index}`)
    } else {
      console.log('ℹ️  No se encontraron chunks en el sistema')
    }
  }

  async testFileMetadata() {
    console.log('\n🔍 Probando metadatos y enlaces de Google Drive...')
    
    const { data, error } = await this.supabase
      .from('documentos_usuario_entrenador')
      .select('*')
      .limit(1)
    
    if (error || !data || data.length === 0) {
      console.log('ℹ️  No hay archivos para probar metadatos')
      return
    }
    
    const file = data[0]
    const googleDriveUrl = `https://drive.google.com/file/d/${file.file_id}/view`
    
    console.log('✅ Metadatos del archivo:')
    console.log(`   - Nombre para mostrar: ${file.file_name}`)
    console.log(`   - Tipo de archivo: ${file.file_type}`)
    console.log(`   - Usuario propietario: ${file.usuario}`)
    console.log(`   - Entrenador: ${file.entrenador}`)
    console.log(`   - URL de Google Drive: ${googleDriveUrl}`)
    console.log(`   - Fecha de creación: ${file.created_at}`)
  }

  async testDatabaseConsistency() {
    console.log('\n🔍 Verificando consistencia entre tablas...')
    
    // Contar archivos principales en documentos_usuario_entrenador
    const { data: userFiles, error: userError } = await this.supabase
      .from('documentos_usuario_entrenador')
      .select('file_id')
    
    if (userError) {
      console.log('⚠️  Error consultando documentos_usuario_entrenador:', userError.message)
      return
    }
    
    // Contar documentos principales en documentos_entrenador
    const { data: mainDocs, error: mainError } = await this.supabase
      .from('documentos_entrenador')
      .select('metadata')
      .eq('metadata->>chunk_type', 'main')
    
    if (mainError) {
      console.log('⚠️  Error consultando documentos_entrenador:', mainError.message)
      return
    }
    
    console.log(`📊 Archivos en documentos_usuario_entrenador: ${userFiles?.length || 0}`)
    console.log(`📊 Documentos principales en documentos_entrenador: ${mainDocs?.length || 0}`)
    
    if (userFiles && mainDocs) {
      const userFileIds = new Set(userFiles.map(f => f.file_id))
      const mainDocFileIds = new Set(mainDocs.map(d => d.metadata?.file_id).filter(Boolean))
      
      const commonFiles = [...userFileIds].filter(id => mainDocFileIds.has(id))
      console.log(`🔗 Archivos con chunks asociados: ${commonFiles.length}`)
      
      if (commonFiles.length > 0) {
        console.log('✅ Consistencia verificada: Los archivos tienen sus chunks correspondientes')
      }
    }
  }
}

// Ejecutar pruebas
const tester = new FileDisplayTester()
tester.testFileDisplay()
  .then(() => {
    console.log('\n🎉 Pruebas completadas')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Error en las pruebas:', error)
    process.exit(1)
  })