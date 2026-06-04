-- Crear tabla sub_carpetas_administrador para registrar subcarpetas de extensiones
CREATE TABLE IF NOT EXISTS sub_carpetas_administrador (
    id SERIAL PRIMARY KEY,
    administrador_email VARCHAR(255) NOT NULL,
    file_id_master VARCHAR(255) NOT NULL, -- ID de la carpeta Master - Brify
    file_id_subcarpeta VARCHAR(255) NOT NULL UNIQUE, -- ID de la subcarpeta (Brify, Abogados, Entrenador)
    nombre_subcarpeta VARCHAR(100) NOT NULL, -- Nombre de la subcarpeta
    tipo_extension VARCHAR(50) NOT NULL, -- 'brify', 'abogados', 'entrenador'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_sub_carpetas_admin_email ON sub_carpetas_administrador(administrador_email);
CREATE INDEX IF NOT EXISTS idx_sub_carpetas_file_id_master ON sub_carpetas_administrador(file_id_master);
CREATE INDEX IF NOT EXISTS idx_sub_carpetas_tipo_extension ON sub_carpetas_administrador(tipo_extension);

-- Habilitar RLS (Row Level Security)
ALTER TABLE sub_carpetas_administrador ENABLE ROW LEVEL SECURITY;

-- Crear política RLS para que cada administrador solo vea sus propias subcarpetas
CREATE POLICY "Administradores pueden ver sus propias subcarpetas" ON sub_carpetas_administrador
    FOR ALL USING (administrador_email = auth.jwt() ->> 'email');

-- Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_sub_carpetas_administrador_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sub_carpetas_administrador_updated_at
    BEFORE UPDATE ON sub_carpetas_administrador
    FOR EACH ROW
    EXECUTE FUNCTION update_sub_carpetas_administrador_updated_at();

-- Comentarios para documentar la tabla
COMMENT ON TABLE sub_carpetas_administrador IS 'Tabla para registrar las subcarpetas de extensiones dentro de la carpeta Master - Brify';
COMMENT ON COLUMN sub_carpetas_administrador.file_id_master IS 'ID de la carpeta padre Master - Brify en Google Drive';
COMMENT ON COLUMN sub_carpetas_administrador.file_id_subcarpeta IS 'ID único de la subcarpeta en Google Drive';
COMMENT ON COLUMN sub_carpetas_administrador.tipo_extension IS 'Tipo de extensión: brify (plan básico), abogados, entrenador';