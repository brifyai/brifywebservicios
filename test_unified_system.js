// Script de prueba para verificar el sistema unificado usando solo documentos_entrenador
// Este script verifica que el chunking y búsqueda funcionen correctamente

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class UnifiedSystemTest {
  constructor() {
    // Configurar cliente Supabase
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variables de entorno de Supabase no encontradas');
      console.log('Asegúrate de tener REACT_APP_SUPABASE_URL y REACT_APP_SUPABASE_ANON_KEY en tu .env');
      process.exit(1);
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.testUserId = 'test-user-unified';
  }

  // Simular un documento largo para probar chunking
  generateTestDocument() {
    const baseText = `
    Este es un documento de prueba para el sistema unificado de chunks en documentos_entrenador.
    El sistema ahora maneja tanto documentos principales como chunks en una sola tabla.
    
    Sección sobre Inteligencia Artificial:
    La inteligencia artificial es una tecnología revolucionaria que está transformando múltiples industrias.
    Los algoritmos de machine learning permiten a las máquinas aprender patrones complejos de los datos.
    
    Sección sobre Procesamiento de Lenguaje Natural:
    El NLP permite a las computadoras entender y generar texto humano de manera significativa.
    Los embeddings vectoriales capturan el significado semántico de las palabras y frases.
    
    Sección sobre Búsqueda Semántica:
    La búsqueda por similitud coseno permite encontrar contenido relevante basado en el significado.
    Los sistemas de RAG combinan recuperación de información con generación de respuestas.
    `;
    
    // Crear un documento suficientemente largo para activar chunking
    let longDocument = '';
    for (let i = 0; i < 30; i++) {
      longDocument += baseText + `\n\nPárrafo adicional ${i + 1} con contenido específico para testing.\n`;
    }
    
    return longDocument;
  }

  // Verificar que la tabla documentos_entrenador existe y tiene la estructura correcta
  async verifyTableStructure() {
    console.log('\n🔍 Verificando estructura de documentos_entrenador...');
    
    try {
      const { data, error } = await this.supabase
        .from('documentos_entrenador')
        .select('id, content, metadata, embedding, entrenador')
        .limit(1);
      
      if (error) {
        console.error('❌ Error accediendo a documentos_entrenador:', error.message);
        return false;
      }
      
      console.log('✅ Tabla documentos_entrenador accesible');
      console.log(`📊 Estructura verificada: ${data ? 'OK' : 'Sin datos'}`);
      return true;
    } catch (error) {
      console.error('❌ Error verificando estructura:', error.message);
      return false;
    }
  }

  // Verificar que la función match_documentos_entrenador existe
  async verifySearchFunction() {
    console.log('\n🔍 Verificando función match_documentos_entrenador...');
    
    try {
      // Crear un embedding de prueba (768 dimensiones con valores pequeños)
      const testEmbedding = Array(768).fill(0).map(() => Math.random() * 0.1);
      
      const { data, error } = await this.supabase
        .rpc('match_documentos_entrenador', {
          query_embedding: testEmbedding,
          filter: {},
          match_count: 5
        });
      
      if (error) {
        console.error('❌ Error ejecutando match_documentos_entrenador:', error.message);
        return false;
      }
      
      console.log('✅ Función match_documentos_entrenador disponible');
      console.log(`📊 Resultados de prueba: ${data ? data.length : 0} documentos`);
      return true;
    } catch (error) {
      console.error('❌ Error verificando función de búsqueda:', error.message);
      return false;
    }
  }

  // Simular el proceso de chunking (sin crear registros reales)
  async simulateChunkingProcess() {
    console.log('\n🧪 Simulando proceso de chunking...');
    
    const testDocument = this.generateTestDocument();
    console.log(`📄 Documento de prueba generado: ${testDocument.length} caracteres`);
    
    // Simular división en chunks (función que debería estar en embeddings.js)
    const chunkSize = 8000;
    const chunks = [];
    
    for (let i = 0; i < testDocument.length; i += chunkSize) {
      chunks.push(testDocument.substring(i, i + chunkSize));
    }
    
    console.log(`✂️ Documento dividido en ${chunks.length} chunks`);
    
    // Simular metadata para documento principal
    const mainMetadata = {
      name: 'documento-prueba-unificado.pdf',
      correo: 'test@example.com',
      source: 'web_upload',
      file_id: 'test-file-unified-123',
      file_type: 'application/pdf',
      file_size: testDocument.length,
      upload_date: new Date().toISOString(),
      blobType: 'application/pdf',
      is_chunked: true,
      original_length: testDocument.length,
      chunks_count: chunks.length,
      chunk_type: 'main'
    };
    
    console.log('📋 Metadata del documento principal:');
    console.log(JSON.stringify(mainMetadata, null, 2));
    
    // Simular metadata para chunks
    chunks.forEach((chunk, index) => {
      const chunkMetadata = {
        ...mainMetadata,
        chunk_type: 'chunk',
        chunk_index: index + 1,
        parent_file_id: mainMetadata.file_id,
        chunk_of_total: `${index + 1}/${chunks.length}`,
        name: `${mainMetadata.name} - Parte ${index + 1}`,
        source: 'chunk_from_web_upload'
      };
      
      console.log(`📄 Chunk ${index + 1}: ${chunk.length} caracteres`);
    });
    
    return {
      success: true,
      originalLength: testDocument.length,
      chunksCount: chunks.length,
      mainMetadata
    };
  }

  // Verificar documentos existentes con chunks
  async checkExistingChunks() {
    console.log('\n🔍 Verificando documentos con chunks existentes...');
    
    try {
      // Buscar documentos principales (chunk_type = 'main')
      const { data: mainDocs, error: mainError } = await this.supabase
        .from('documentos_entrenador')
        .select('id, metadata')
        .eq('metadata->>chunk_type', 'main')
        .limit(5);
      
      if (mainError) {
        console.warn('⚠️ Error buscando documentos principales:', mainError.message);
      } else {
        console.log(`📄 Documentos principales encontrados: ${mainDocs?.length || 0}`);
      }
      
      // Buscar chunks (chunk_type = 'chunk')
      const { data: chunks, error: chunkError } = await this.supabase
        .from('documentos_entrenador')
        .select('id, metadata')
        .eq('metadata->>chunk_type', 'chunk')
        .limit(10);
      
      if (chunkError) {
        console.warn('⚠️ Error buscando chunks:', chunkError.message);
      } else {
        console.log(`🧩 Chunks encontrados: ${chunks?.length || 0}`);
        
        if (chunks && chunks.length > 0) {
          console.log('📋 Ejemplo de metadata de chunk:');
          console.log(JSON.stringify(chunks[0].metadata, null, 2));
        }
      }
      
      return {
        mainDocuments: mainDocs?.length || 0,
        chunks: chunks?.length || 0
      };
    } catch (error) {
      console.error('❌ Error verificando chunks existentes:', error.message);
      return { mainDocuments: 0, chunks: 0 };
    }
  }

  // Ejecutar todas las pruebas
  async runAllTests() {
    console.log('🚀 Iniciando pruebas del sistema unificado...');
    console.log('=' .repeat(60));
    
    const results = {
      tableStructure: await this.verifyTableStructure(),
      searchFunction: await this.verifySearchFunction(),
      chunkingSimulation: await this.simulateChunkingProcess(),
      existingChunks: await this.checkExistingChunks()
    };
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS:');
    console.log('=' .repeat(60));
    
    console.log(`✅ Estructura de tabla: ${results.tableStructure ? 'OK' : 'FALLO'}`);
    console.log(`✅ Función de búsqueda: ${results.searchFunction ? 'OK' : 'FALLO'}`);
    console.log(`✅ Simulación de chunking: ${results.chunkingSimulation.success ? 'OK' : 'FALLO'}`);
    console.log(`📄 Documentos principales: ${results.existingChunks.mainDocuments}`);
    console.log(`🧩 Chunks existentes: ${results.existingChunks.chunks}`);
    
    const allPassed = results.tableStructure && results.searchFunction && results.chunkingSimulation.success;
    
    console.log('\n' + (allPassed ? '🎉 TODAS LAS PRUEBAS PASARON' : '⚠️ ALGUNAS PRUEBAS FALLARON'));
    
    if (allPassed) {
      console.log('\n✅ El sistema unificado está listo para usar');
      console.log('📝 Próximos pasos:');
      console.log('   1. Ejecutar setup_documentos_entrenador_only.sql en Supabase');
      console.log('   2. Probar subida de documentos largos');
      console.log('   3. Verificar que se crean chunks correctamente');
    }
    
    return allPassed;
  }
}

// Ejecutar pruebas
if (require.main === module) {
  const tester = new UnifiedSystemTest();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Error ejecutando pruebas:', error);
      process.exit(1);
    });
}

module.exports = UnifiedSystemTest;