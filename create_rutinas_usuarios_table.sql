-- Migración para crear tabla rutinas_usuarios
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla rutinas_usuarios
CREATE TABLE IF NOT EXISTS rutinas_usuarios (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  plan_semanal JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_rutinas_usuarios_user_email 
ON rutinas_usuarios(user_email);

CREATE INDEX IF NOT EXISTS idx_rutinas_usuarios_created_at 
ON rutinas_usuarios(created_at);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE rutinas_usuarios ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
CREATE POLICY "Users can view their own routines" ON rutinas_usuarios
  FOR SELECT USING (user_email = auth.email());

CREATE POLICY "Users can insert their own routines" ON rutinas_usuarios
  FOR INSERT WITH CHECK (user_email = auth.email());

CREATE POLICY "Users can update their own routines" ON rutinas_usuarios
  FOR UPDATE USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY "Users can delete their own routines" ON rutinas_usuarios
  FOR DELETE USING (user_email = auth.email());

-- 5. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_rutinas_usuarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Crear trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_rutinas_usuarios_updated_at ON rutinas_usuarios;
CREATE TRIGGER update_rutinas_usuarios_updated_at
    BEFORE UPDATE ON rutinas_usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_rutinas_usuarios_updated_at();

-- 7. Agregar comentarios explicativos
COMMENT ON TABLE rutinas_usuarios IS 'Tabla para almacenar rutinas semanales de usuarios';
COMMENT ON COLUMN rutinas_usuarios.user_email IS 'Email del usuario (único por rutina)';
COMMENT ON COLUMN rutinas_usuarios.plan_semanal IS 'Plan semanal en formato JSONB con estructura de días';

-- 8. Verificar que la tabla se creó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'rutinas_usuarios' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'rutinas_usuarios'
ORDER BY policyname;

-- Mensaje de confirmación
SELECT '✅ Tabla rutinas_usuarios creada exitosamente' as status;
SELECT '📋 Lista para almacenar rutinas semanales en formato JSONB' as info;