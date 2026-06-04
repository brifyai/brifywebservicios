-- Crear tabla para registrar estadísticas de actividad de usuarios
-- Esta tabla almacenará métricas importantes para el Dashboard

CREATE TABLE IF NOT EXISTS user_activity_stats (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Estadísticas de archivos
    files_uploaded INTEGER DEFAULT 0,
    files_processed INTEGER DEFAULT 0,
    files_size_total BIGINT DEFAULT 0, -- tamaño total en bytes
    
    -- Estadísticas de búsquedas
    semantic_searches INTEGER DEFAULT 0,
    text_searches INTEGER DEFAULT 0,
    legal_searches INTEGER DEFAULT 0,
    
    -- Estadísticas de chat IA
    ai_chat_sessions INTEGER DEFAULT 0,
    ai_chat_messages INTEGER DEFAULT 0,
    ai_tokens_used INTEGER DEFAULT 0,
    
    -- Estadísticas de sincronización
    drive_sync_count INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Fechas importantes
    first_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Período de registro (para estadísticas diarias/semanales/mensuales)
    period_type VARCHAR(10) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    period_date DATE NOT NULL,
    
    -- Métricas adicionales
    api_calls INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    session_duration_seconds INTEGER DEFAULT 0
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_user_id ON user_activity_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_period_date ON user_activity_stats(period_date);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_period_type ON user_activity_stats(period_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_last_activity ON user_activity_stats(last_activity_at);

-- Crear índice compuesto para consultas de dashboard
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_user_period ON user_activity_stats(user_id, period_type, period_date);

-- Comentario sobre la tabla
COMMENT ON TABLE user_activity_stats IS 'Tabla de estadísticas de actividad de usuarios para el Dashboard';
COMMENT ON COLUMN user_activity_stats.files_uploaded IS 'Cantidad total de archivos subidos por el usuario';
COMMENT ON COLUMN user_activity_stats.semantic_searches IS 'Cantidad de búsquedas semánticas realizadas';
COMMENT ON COLUMN user_activity_stats.ai_chat_sessions IS 'Cantidad de sesiones de chat IA iniciadas';
COMMENT ON COLUMN user_activity_stats.ai_tokens_used IS 'Cantidad total de tokens de IA consumidos';
COMMENT ON COLUMN user_activity_stats.drive_sync_count IS 'Cantidad de sincronizaciones de Drive realizadas';

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_activity_stats_updated_at 
    BEFORE UPDATE ON user_activity_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar actividad de usuario
CREATE OR REPLACE FUNCTION log_user_activity(
    p_user_id UUID,
    p_activity_type TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
    -- Insertar o actualizar estadísticas diarias
    INSERT INTO user_activity_stats (
        user_id,
        files_uploaded,
        files_processed,
        semantic_searches,
        text_searches,
        legal_searches,
        ai_chat_sessions,
        ai_chat_messages,
        ai_tokens_used,
        drive_sync_count,
        last_activity_at,
        period_date
    )
    VALUES (
        p_user_id,
        CASE WHEN p_activity_type = 'file_upload' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'file_process' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'semantic_search' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'text_search' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'legal_search' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'ai_chat_session' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'ai_chat_message' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'ai_tokens' THEN p_increment ELSE 0 END,
        CASE WHEN p_activity_type = 'drive_sync' THEN p_increment ELSE 0 END,
        NOW(),
        CURRENT_DATE
    )
    ON CONFLICT (user_id, period_date)
    DO UPDATE SET
        files_uploaded = CASE WHEN p_activity_type = 'file_upload' THEN user_activity_stats.files_uploaded + p_increment ELSE user_activity_stats.files_uploaded END,
        files_processed = CASE WHEN p_activity_type = 'file_process' THEN user_activity_stats.files_processed + p_increment ELSE user_activity_stats.files_processed END,
        semantic_searches = CASE WHEN p_activity_type = 'semantic_search' THEN user_activity_stats.semantic_searches + p_increment ELSE user_activity_stats.semantic_searches END,
        text_searches = CASE WHEN p_activity_type = 'text_search' THEN user_activity_stats.text_searches + p_increment ELSE user_activity_stats.text_searches END,
        legal_searches = CASE WHEN p_activity_type = 'legal_search' THEN user_activity_stats.legal_searches + p_increment ELSE user_activity_stats.legal_searches END,
        ai_chat_sessions = CASE WHEN p_activity_type = 'ai_chat_session' THEN user_activity_stats.ai_chat_sessions + p_increment ELSE user_activity_stats.ai_chat_sessions END,
        ai_chat_messages = CASE WHEN p_activity_type = 'ai_chat_message' THEN user_activity_stats.ai_chat_messages + p_increment ELSE user_activity_stats.ai_chat_messages END,
        ai_tokens_used = CASE WHEN p_activity_type = 'ai_tokens' THEN user_activity_stats.ai_tokens_used + p_increment ELSE user_activity_stats.ai_tokens_used END,
        drive_sync_count = CASE WHEN p_activity_type = 'drive_sync' THEN user_activity_stats.drive_sync_count + p_increment ELSE user_activity_stats.drive_sync_count END,
        last_activity_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Ejemplos de uso:
-- Para registrar un archivo subido:
-- SELECT log_user_activity('user_uuid', 'file_upload', 1);

-- Para registrar una búsqueda semántica:
-- SELECT log_user_activity('user_uuid', 'semantic_search', 1);

-- Para registrar tokens consumidos:
-- SELECT log_user_activity('user_uuid', 'ai_tokens', 150);

-- Para registrar sincronización Drive:
-- SELECT log_user_activity('user_uuid', 'drive_sync', 1);

-- Vista para obtener estadísticas consolidadas del usuario
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT 
    user_id,
    SUM(files_uploaded) as total_files_uploaded,
    SUM(files_processed) as total_files_processed,
    SUM(semantic_searches) as total_semantic_searches,
    SUM(text_searches) as total_text_searches,
    SUM(legal_searches) as total_legal_searches,
    SUM(ai_chat_sessions) as total_ai_chat_sessions,
    SUM(ai_chat_messages) as total_ai_chat_messages,
    SUM(ai_tokens_used) as total_ai_tokens_used,
    SUM(drive_sync_count) as total_drive_sync_count,
    MAX(last_activity_at) as last_activity,
    MIN(first_activity_at) as first_activity
FROM user_activity_stats 
GROUP BY user_id;

-- Consulta para obtener actividad reciente (últimos 7 días)
CREATE OR REPLACE VIEW user_recent_activity AS
SELECT 
    u.id as user_id,
    u.email,
    COALESCE(stats.files_uploaded, 0) as files_uploaded,
    COALESCE(stats.semantic_searches, 0) as semantic_searches,
    COALESCE(stats.ai_chat_sessions, 0) as ai_chat_sessions,
    COALESCE(stats.last_activity_at, u.created_at) as last_activity
FROM auth.users u
LEFT JOIN (
    SELECT 
        user_id,
        SUM(files_uploaded) as files_uploaded,
        SUM(semantic_searches) as semantic_searches,
        SUM(ai_chat_sessions) as ai_chat_sessions,
        MAX(last_activity_at) as last_activity_at
    FROM user_activity_stats 
    WHERE period_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY user_id
) stats ON u.id = stats.user_id;