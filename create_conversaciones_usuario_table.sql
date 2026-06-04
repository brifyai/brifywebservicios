-- Crear tabla conversaciones_usuario para almacenar conversaciones por usuario
-- Estructura: Un registro único por usuario con conversaciones en formato JSONB
-- Máximo 5 conversaciones, se elimina la más antigua automáticamente

CREATE TABLE IF NOT EXISTS conversaciones_usuario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_email TEXT NOT NULL UNIQUE, -- Email del usuario (único)
    conversaciones JSONB DEFAULT '[]'::jsonb, -- Array de conversaciones en formato JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_email ON conversaciones_usuario(usuario_email);

-- Crear índice GIN para búsquedas en el campo JSONB
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_jsonb ON conversaciones_usuario USING GIN (conversaciones);

-- Función para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_conversaciones_usuario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS trigger_update_conversaciones_usuario_updated_at ON conversaciones_usuario;
CREATE TRIGGER trigger_update_conversaciones_usuario_updated_at
    BEFORE UPDATE ON conversaciones_usuario
    FOR EACH ROW
    EXECUTE FUNCTION update_conversaciones_usuario_updated_at();

-- Comentarios para documentar la estructura del JSONB
COMMENT ON COLUMN conversaciones_usuario.conversaciones IS 
'Array JSONB que contiene hasta 5 conversaciones. Estructura:
[
  {
    "id": "uuid_unico",
    "tipo": "chat_general|busqueda_semantica|chat_ia",
    "pregunta": "texto de la pregunta",
    "respuesta": "texto de la respuesta",
    "fecha": "2024-01-01T12:00:00Z"
  }
]
Se mantienen máximo 5 conversaciones, eliminando la más antigua automáticamente.';