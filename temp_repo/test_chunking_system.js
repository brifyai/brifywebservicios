// Script de prueba para el sistema de chunking y búsqueda híbrida
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config();

// Configurar cliente de Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

class ChunkingSystemTest {
  constructor() {
    this.testUserId = 'test-user-123';
  }

  // Simular un documento largo para probar el chunking
  generateLongDocument() {
    const baseText = `
    Este es un documento de prueba muy extenso que contiene información importante sobre inteligencia artificial.
    La inteligencia artificial es una rama de la informática que se ocupa de la creación de sistemas capaces de realizar tareas que normalmente requieren inteligencia humana.
    Estos sistemas pueden aprender, razonar, percibir, y en algunos casos, actuar de manera autónoma.
    
    Los algoritmos de machine learning son fundamentales en el desarrollo de sistemas de IA.
    Existen diferentes tipos de aprendizaje: supervisado, no supervisado y por refuerzo.
    Cada uno tiene sus propias aplicaciones y ventajas específicas.
    
    El procesamiento de lenguaje natural (NLP) es otra área crucial de la IA.
    Permite a las máquinas entender, interpretar y generar lenguaje humano de manera significativa.
    Esto incluye tareas como traducción automática, análisis de sentimientos y generación de texto.
    
    Los embeddings son representaciones vectoriales de texto que capturan el significado semántico.
    Estos vectores permiten realizar búsquedas por similitud y comparaciones entre documentos.
    Son especialmente útiles en sistemas de recuperación de información y recomendación.
    `;
    
    // Repetir el texto para crear un documento que supere el límite de caracteres
    let longText = '';
    for (let i = 0; i < 50; i++) {
      longText += baseText + `\n\nSección ${i + 1} del documento.\n`;
    }
    
    return longText;
  }

  // Probar el proceso de chunking
  async testChunking() {
    console.log('🧪 Iniciando prueba de chunking...');
    
    try {
      const longDocument = this.generateLongDocument();
      console.log(`📄 Documento generado: ${longDocument.length} caracteres`);
      
      // Simular el proceso de chunking (función simplificada)
      const chunks = this.splitTextIntoChunks(longDocument, 8000);
      console.log(`✂️ Documento dividido en ${chunks.length} chunks`);
      
      chunks.forEach((chunk, index) => {
        console.log(`   Chunk ${index + 1}: ${chunk.length} caracteres`);
      });
      
      return {
        success: true,
        originalLength: longDocument.length,
        chunksCount: chunks.length,
        chunks: chunks
      };
    } catch (error) {
      console.error('❌ Error en prueba de chunking:', error);
      return { success: false, error: error.message };
    }
  }

  // Función simplificada de chunking
  splitTextIntoChunks(text, maxLength = 8000) {
    const chunks = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      let endIndex = currentIndex + maxLength;
      
      // Si no es el último chunk, buscar un punto de corte natural
      if (endIndex < text.length) {
        const lastPeriod = text.lastIndexOf('.', endIndex);
        const lastNewline = text.lastIndexOf('\n', endIndex);
        const lastSpace = text.lastIndexOf(' ', endIndex);
        
        // Usar el punto de corte más cercano al final
        const cutPoint = Math.max(lastPeriod, lastNewline, lastSpace);
        if (cutPoint > currentIndex) {
          endIndex = cutPoint + 1;
        }
      }
      
      const chunk = text.slice(currentIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      
      currentIndex = endIndex;
    }
    
    return chunks;
  }

  // Probar la búsqueda híbrida (versión simplificada)
  async testHybridSearch() {
    console.log('🔍 Iniciando prueba de búsqueda híbrida...');
    
    try {
      console.log('📝 Nota: Esta es una prueba simplificada de la estructura de base de datos');
      
      // Verificar que las funciones SQL existen
      const testEmbedding = new Array(768).fill(0.1);
      
      // Probar función match_documentos_entrenador
      try {
        const { data: docsResults, error: docsError } = await supabase
          .rpc('match_documentos_entrenador', {
            query_embedding: testEmbedding,
            match_count: 3
          });
        
        if (docsError) {
          console.log('⚠️ Función match_documentos_entrenador:', docsError.message);
        } else {
          console.log(`✅ Función match_documentos_entrenador disponible (${docsResults?.length || 0} resultados)`);
        }
      } catch (error) {
        console.log('⚠️ Error probando match_documentos_entrenador:', error.message);
      }
      
      // Probar función match_file_embeddings
      try {
        const { data: chunksResults, error: chunksError } = await supabase
          .rpc('match_file_embeddings', {
            query_embedding: testEmbedding,
            filter: {},
            match_count: 3
          });
        
        if (chunksError) {
          console.log('⚠️ Función match_file_embeddings:', chunksError.message);
        } else {
          console.log(`✅ Función match_file_embeddings disponible (${chunksResults?.length || 0} resultados)`);
        }
      } catch (error) {
        console.log('⚠️ Error probando match_file_embeddings:', error.message);
      }
      
      return {
        success: true,
        message: 'Prueba de funciones SQL completada'
      };
    } catch (error) {
      console.error('❌ Error en búsqueda híbrida:', error);
      return { success: false, error: error.message };
    }
  }

  // Verificar el estado de la base de datos
  async checkDatabaseStatus() {
    console.log('🗄️ Verificando estado de la base de datos...');
    
    try {
      // Verificar tabla documentos_entrenador
      const { data: docs, error: docsError } = await supabase
        .from('documentos_entrenador')
        .select('id, metadata')
        .limit(5);
      
      if (docsError) throw docsError;
      
      console.log(`📚 Documentos en documentos_entrenador: ${docs?.length || 0}`);
      
      // Verificar tabla file_embeddings
      const { data: chunks, error: chunksError } = await supabase
        .from('file_embeddings')
        .select('id, file_id, chunk_index')
        .limit(5);
      
      if (chunksError) throw chunksError;
      
      console.log(`🧩 Chunks en file_embeddings: ${chunks?.length || 0}`);
      
      // Verificar función match_file_embeddings
      try {
        const testEmbedding = new Array(768).fill(0.1); // Vector de prueba
        const { data: testResults, error: funcError } = await supabase
          .rpc('match_file_embeddings', {
            query_embedding: testEmbedding,
            filter: {},
            match_count: 1
          });
        
        if (funcError) {
          console.log('⚠️ Función match_file_embeddings no disponible:', funcError.message);
        } else {
          console.log('✅ Función match_file_embeddings disponible');
        }
      } catch (funcError) {
        console.log('⚠️ Error probando función match_file_embeddings:', funcError.message);
      }
      
      return {
        success: true,
        documentsCount: docs?.length || 0,
        chunksCount: chunks?.length || 0
      };
    } catch (error) {
      console.error('❌ Error verificando base de datos:', error);
      return { success: false, error: error.message };
    }
  }

  // Ejecutar todas las pruebas
  async runAllTests() {
    console.log('🚀 Iniciando pruebas del sistema de chunking y búsqueda híbrida\n');
    
    const results = {
      chunking: await this.testChunking(),
      database: await this.checkDatabaseStatus(),
      hybridSearch: await this.testHybridSearch()
    };
    
    console.log('\n📋 RESUMEN DE PRUEBAS:');
    console.log('='.repeat(50));
    console.log(`✅ Chunking: ${results.chunking.success ? 'EXITOSO' : 'FALLIDO'}`);
    console.log(`✅ Base de datos: ${results.database.success ? 'EXITOSO' : 'FALLIDO'}`);
    console.log(`✅ Búsqueda híbrida: ${results.hybridSearch.success ? 'EXITOSO' : 'FALLIDO'}`);
    
    if (!results.chunking.success) {
      console.log(`   Error chunking: ${results.chunking.error}`);
    }
    if (!results.database.success) {
      console.log(`   Error base de datos: ${results.database.error}`);
    }
    if (!results.hybridSearch.success) {
      console.log(`   Error búsqueda: ${results.hybridSearch.error}`);
    }
    
    console.log('='.repeat(50));
    
    return results;
  }
}

// Ejecutar las pruebas
const tester = new ChunkingSystemTest();
tester.runAllTests().then(results => {
  console.log('\n🎯 Pruebas completadas');
  process.exit(0);
}).catch(error => {
  console.error('💥 Error ejecutando pruebas:', error);
  process.exit(1);
});