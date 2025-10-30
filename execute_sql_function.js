// Script para ejecutar la función SQL match_file_embeddings en Supabase
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
  console.log('Asegúrate de tener REACT_APP_SUPABASE_URL y REACT_APP_SUPABASE_ANON_KEY en tu archivo .env');
  console.log('Variables encontradas:');
  console.log('- REACT_APP_SUPABASE_URL:', supabaseUrl ? '✅ Configurada' : '❌ No encontrada');
  console.log('- REACT_APP_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Configurada' : '❌ No encontrada');
  
  // Mostrar la función SQL para ejecución manual
  console.log('\n📝 Función SQL para ejecutar manualmente en Supabase:');
  console.log('=' .repeat(80));
  
  const sqlFunction = `CREATE OR REPLACE FUNCTION match_file_embeddings(
  query_embedding vector(768),
  filter jsonb DEFAULT '{}',
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  file_id text,
  chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fe.id,
    fe.content,
    jsonb_build_object(
      'file_name', COALESCE(de.metadata->>'file_name', 'Documento sin nombre'),
      'file_id', fe.file_id,
      'chunk_index', fe.chunk_index,
      'source', 'chunk'
    ) as metadata,
    1 - (fe.embedding <=> query_embedding) as similarity,
    fe.file_id,
    fe.chunk_index
  FROM file_embeddings fe
  INNER JOIN documentos_entrenador de ON fe.file_id = de.metadata->>'file_id'
  ORDER BY 
    similarity DESC
  LIMIT 
    match_count;
END;
$$;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_file_embeddings_embedding 
ON file_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_file_embeddings_file_id 
ON file_embeddings (file_id);

CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_file_id 
ON documentos_entrenador USING gin ((metadata->>'file_id'));`;
  
  console.log(sqlFunction);
  console.log('=' .repeat(80));
  
  console.log('\n📋 INSTRUCCIONES:');
  console.log('1. Ve a tu dashboard de Supabase');
  console.log('2. Navega a SQL Editor');
  console.log('3. Copia y pega la función SQL mostrada arriba');
  console.log('4. Ejecuta la función');
  console.log('5. Verifica que se creó correctamente');
  
  return;
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function executeSQLFunction() {
  try {
    console.log('🔄 Ejecutando función SQL match_file_embeddings...');
    
    // Leer el archivo SQL
    const sqlContent = fs.readFileSync(
      path.join(__dirname, 'create_match_file_embeddings_function.sql'), 
      'utf8'
    );
    
    // Ejecutar la función SQL
    const { data, error } = await supabase.rpc('exec', {
      sql: sqlContent
    });
    
    if (error) {
      console.error('❌ Error ejecutando función SQL:', error);
      return;
    }
    
    console.log('✅ Función SQL ejecutada exitosamente');
    console.log('📊 Resultado:', data);
    
    // Probar la función con un embedding de prueba
    console.log('\n🧪 Probando la función match_file_embeddings...');
    
    // Crear un embedding de prueba (768 dimensiones con valores aleatorios pequeños)
    const testEmbedding = Array.from({ length: 768 }, () => Math.random() * 0.1 - 0.05);
    
    const { data: testResult, error: testError } = await supabase
      .rpc('match_file_embeddings', {
        query_embedding: testEmbedding,
        filter: {},
        match_count: 5
      });
    
    if (testError) {
      console.error('❌ Error probando función:', testError);
    } else {
      console.log('✅ Función de prueba ejecutada correctamente');
      console.log('📊 Resultados encontrados:', testResult?.length || 0);
      if (testResult && testResult.length > 0) {
        console.log('📄 Primer resultado:', {
          content: testResult[0].content?.substring(0, 100) + '...',
          similarity: testResult[0].similarity,
          file_id: testResult[0].file_id
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Función alternativa usando SQL directo
async function executeSQLDirect() {
  try {
    console.log('🔄 Ejecutando SQL directo...');
    
    const sqlFunction = `
CREATE OR REPLACE FUNCTION match_file_embeddings(
  query_embedding vector(768),
  filter jsonb DEFAULT '{}',
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  file_id text,
  chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fe.id,
    fe.content,
    jsonb_build_object(
      'file_name', COALESCE(de.metadata->>'file_name', 'Documento sin nombre'),
      'file_id', fe.file_id,
      'chunk_index', fe.chunk_index,
      'source', 'chunk'
    ) as metadata,
    1 - (fe.embedding <=> query_embedding) as similarity,
    fe.file_id,
    fe.chunk_index
  FROM file_embeddings fe
  INNER JOIN documentos_entrenador de ON fe.file_id = de.metadata->>'file_id'
  ORDER BY 
    similarity DESC
  LIMIT 
    match_count;
END;
$$;`;
    
    // Intentar ejecutar usando diferentes métodos
    console.log('Método 1: Usando query directo...');
    const { data: result1, error: error1 } = await supabase
      .from('pg_stat_user_functions')
      .select('*')
      .limit(1);
    
    if (error1) {
      console.log('❌ Método 1 falló:', error1.message);
    } else {
      console.log('✅ Conexión a base de datos exitosa');
    }
    
    console.log('\n📝 Función SQL creada (copiar y ejecutar manualmente en Supabase):');
    console.log('=' .repeat(80));
    console.log(sqlFunction);
    console.log('=' .repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar ambos métodos
async function main() {
  console.log('🚀 Iniciando ejecución de función SQL...');
  console.log('📍 URL Supabase:', supabaseUrl);
  
  await executeSQLDirect();
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 INSTRUCCIONES MANUALES:');
  console.log('1. Copia la función SQL mostrada arriba');
  console.log('2. Ve a tu dashboard de Supabase');
  console.log('3. Navega a SQL Editor');
  console.log('4. Pega y ejecuta la función');
  console.log('5. Verifica que se creó correctamente');
  console.log('='.repeat(80));
}

main().catch(console.error);