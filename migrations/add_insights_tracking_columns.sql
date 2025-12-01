-- Migración para agregar columnas de tracking para Insights de IA
-- Fecha: 2024

-- Agregar columnas para tracking de uso a conversaciones_usuario
ALTER TABLE conversaciones_usuario 
ADD COLUMN IF NOT EXISTS total_searches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_searches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_search_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS week_start_date TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('week', NOW());

-- Crear índices para optimizar consultas de insights
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_week_start ON conversaciones_usuario(week_start_date);
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_last_search ON conversaciones_usuario(last_search_date);

-- Función para resetear contadores semanales
CREATE OR REPLACE FUNCTION reset_weekly_search_counters()
RETURNS void AS $$
BEGIN
    UPDATE conversaciones_usuario 
    SET 
        weekly_searches = 0,
        week_start_date = DATE_TRUNC('week', NOW())
    WHERE week_start_date < DATE_TRUNC('week', NOW());
END;
$$ LANGUAGE plpgsql;

-- Función para incrementar contador de búsquedas
CREATE OR REPLACE FUNCTION increment_search_counter(user_email TEXT)
RETURNS void AS $$
DECLARE
    current_week_start TIMESTAMP WITH TIME ZONE;
BEGIN
    current_week_start := DATE_TRUNC('week', NOW());
    
    -- Insertar o actualizar registro del usuario
    INSERT INTO conversaciones_usuario (usuario_email, total_searches, weekly_searches, last_search_date, week_start_date)
    VALUES (user_email, 1, 1, NOW(), current_week_start)
    ON CONFLICT (usuario_email) 
    DO UPDATE SET 
        total_searches = conversaciones_usuario.total_searches + 1,
        weekly_searches = CASE 
            WHEN conversaciones_usuario.week_start_date < current_week_start THEN 1
            ELSE conversaciones_usuario.weekly_searches + 1
        END,
        last_search_date = NOW(),
        week_start_date = current_week_start,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentar las nuevas columnas
COMMENT ON COLUMN conversaciones_usuario.total_searches IS 'Contador total de búsquedas del usuario';
COMMENT ON COLUMN conversaciones_usuario.weekly_searches IS 'Contador de búsquedas de la semana actual';
COMMENT ON COLUMN conversaciones_usuario.last_search_date IS 'Fecha de la última búsqueda realizada';
COMMENT ON COLUMN conversaciones_usuario.week_start_date IS 'Fecha de inicio de la semana actual para el contador';