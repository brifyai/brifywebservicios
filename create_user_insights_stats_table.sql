-- Crear tabla user_insights_stats para estadísticas de Insights de IA
-- Esta tabla almacena métricas agregadas por usuario y semana

CREATE TABLE IF NOT EXISTS user_insights_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_email TEXT NOT NULL,
    week_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Métricas de búsquedas y conversaciones
    total_searches INTEGER DEFAULT 0,
    semantic_searches INTEGER DEFAULT 0,
    chat_ia_conversations INTEGER DEFAULT 0,
    
    -- Métricas de tokens
    tokens_used INTEGER DEFAULT 0,
    tokens_limit INTEGER DEFAULT 1500, -- Límite por defecto
    
    -- Métricas de documentos
    documents_processed INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    
    -- Porcentajes calculados (se actualizan automáticamente)
    search_growth_percentage DECIMAL(5,2) DEFAULT 0.0,
    token_usage_percentage DECIMAL(5,2) DEFAULT 0.0,
    document_growth_percentage DECIMAL(5,2) DEFAULT 0.0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para evitar duplicados por usuario y semana
    UNIQUE(usuario_email, week_start_date)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_insights_stats_email ON user_insights_stats(usuario_email);
CREATE INDEX IF NOT EXISTS idx_user_insights_stats_week ON user_insights_stats(week_start_date);
CREATE INDEX IF NOT EXISTS idx_user_insights_stats_email_week ON user_insights_stats(usuario_email, week_start_date);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_insights_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_user_insights_stats_updated_at ON user_insights_stats;
CREATE TRIGGER trigger_update_user_insights_stats_updated_at
    BEFORE UPDATE ON user_insights_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_user_insights_stats_updated_at();

-- Función para obtener o crear estadísticas de la semana actual
CREATE OR REPLACE FUNCTION get_or_create_current_week_stats(user_email TEXT)
RETURNS user_insights_stats AS $$
DECLARE
    current_week TIMESTAMP WITH TIME ZONE;
    stats_record user_insights_stats;
BEGIN
    current_week := DATE_TRUNC('week', NOW());
    
    -- Intentar obtener el registro existente
    SELECT * INTO stats_record 
    FROM user_insights_stats 
    WHERE usuario_email = user_email AND week_start_date = current_week;
    
    -- Si no existe, crear uno nuevo
    IF NOT FOUND THEN
        INSERT INTO user_insights_stats (usuario_email, week_start_date)
        VALUES (user_email, current_week)
        RETURNING * INTO stats_record;
    END IF;
    
    RETURN stats_record;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar estadísticas de búsqueda
CREATE OR REPLACE FUNCTION update_search_stats(user_email TEXT, search_type TEXT DEFAULT 'semantic')
RETURNS void AS $$
DECLARE
    current_week TIMESTAMP WITH TIME ZONE;
    previous_week_searches INTEGER DEFAULT 0;
    current_searches INTEGER;
    growth_percentage DECIMAL(5,2);
BEGIN
    current_week := DATE_TRUNC('week', NOW());
    
    -- Obtener búsquedas de la semana anterior para calcular crecimiento
    SELECT COALESCE(total_searches, 0) INTO previous_week_searches
    FROM user_insights_stats 
    WHERE usuario_email = user_email 
    AND week_start_date = current_week - INTERVAL '1 week';
    
    -- Insertar o actualizar estadísticas de la semana actual
    INSERT INTO user_insights_stats (
        usuario_email, 
        week_start_date, 
        total_searches,
        semantic_searches,
        chat_ia_conversations
    )
    VALUES (
        user_email, 
        current_week, 
        1,
        CASE WHEN search_type = 'semantic' THEN 1 ELSE 0 END,
        CASE WHEN search_type = 'chat_ia' THEN 1 ELSE 0 END
    )
    ON CONFLICT (usuario_email, week_start_date) 
    DO UPDATE SET 
        total_searches = user_insights_stats.total_searches + 1,
        semantic_searches = user_insights_stats.semantic_searches + 
            CASE WHEN search_type = 'semantic' THEN 1 ELSE 0 END,
        chat_ia_conversations = user_insights_stats.chat_ia_conversations + 
            CASE WHEN search_type = 'chat_ia' THEN 1 ELSE 0 END,
        updated_at = NOW()
    RETURNING total_searches INTO current_searches;
    
    -- Calcular porcentaje de crecimiento
    IF previous_week_searches > 0 THEN
        growth_percentage := ((current_searches - previous_week_searches)::DECIMAL / previous_week_searches) * 100;
    ELSE
        growth_percentage := CASE WHEN current_searches > 0 THEN 100.0 ELSE 0.0 END;
    END IF;
    
    -- Actualizar porcentaje de crecimiento
    UPDATE user_insights_stats 
    SET search_growth_percentage = growth_percentage
    WHERE usuario_email = user_email AND week_start_date = current_week;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar estadísticas de tokens
CREATE OR REPLACE FUNCTION update_token_stats(user_email TEXT, tokens_consumed INTEGER)
RETURNS void AS $$
DECLARE
    current_week TIMESTAMP WITH TIME ZONE;
    usage_percentage DECIMAL(5,2);
BEGIN
    current_week := DATE_TRUNC('week', NOW());
    
    -- Insertar o actualizar estadísticas de tokens
    INSERT INTO user_insights_stats (usuario_email, week_start_date, tokens_used)
    VALUES (user_email, current_week, tokens_consumed)
    ON CONFLICT (usuario_email, week_start_date) 
    DO UPDATE SET 
        tokens_used = user_insights_stats.tokens_used + tokens_consumed,
        updated_at = NOW();
    
    -- Calcular y actualizar porcentaje de uso de tokens
    UPDATE user_insights_stats 
    SET token_usage_percentage = (tokens_used::DECIMAL / tokens_limit) * 100
    WHERE usuario_email = user_email AND week_start_date = current_week;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar estadísticas de documentos
CREATE OR REPLACE FUNCTION update_document_stats(user_email TEXT, doc_type TEXT DEFAULT 'processed')
RETURNS void AS $$
DECLARE
    current_week TIMESTAMP WITH TIME ZONE;
    previous_week_docs INTEGER DEFAULT 0;
    current_docs INTEGER;
    growth_percentage DECIMAL(5,2);
BEGIN
    current_week := DATE_TRUNC('week', NOW());
    
    -- Obtener documentos de la semana anterior
    SELECT COALESCE(documents_processed, 0) INTO previous_week_docs
    FROM user_insights_stats 
    WHERE usuario_email = user_email 
    AND week_start_date = current_week - INTERVAL '1 week';
    
    -- Actualizar estadísticas
    INSERT INTO user_insights_stats (
        usuario_email, 
        week_start_date, 
        documents_processed,
        documents_uploaded
    )
    VALUES (
        user_email, 
        current_week, 
        CASE WHEN doc_type = 'processed' THEN 1 ELSE 0 END,
        CASE WHEN doc_type = 'uploaded' THEN 1 ELSE 0 END
    )
    ON CONFLICT (usuario_email, week_start_date) 
    DO UPDATE SET 
        documents_processed = user_insights_stats.documents_processed + 
            CASE WHEN doc_type = 'processed' THEN 1 ELSE 0 END,
        documents_uploaded = user_insights_stats.documents_uploaded + 
            CASE WHEN doc_type = 'uploaded' THEN 1 ELSE 0 END,
        updated_at = NOW()
    RETURNING documents_processed INTO current_docs;
    
    -- Calcular porcentaje de crecimiento
    IF previous_week_docs > 0 THEN
        growth_percentage := ((current_docs - previous_week_docs)::DECIMAL / previous_week_docs) * 100;
    ELSE
        growth_percentage := CASE WHEN current_docs > 0 THEN 100.0 ELSE 0.0 END;
    END IF;
    
    -- Actualizar porcentaje
    UPDATE user_insights_stats 
    SET document_growth_percentage = growth_percentage
    WHERE usuario_email = user_email AND week_start_date = current_week;
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentar la tabla
COMMENT ON TABLE user_insights_stats IS 'Estadísticas agregadas por usuario y semana para Insights de IA';
COMMENT ON COLUMN user_insights_stats.search_growth_percentage IS 'Porcentaje de crecimiento de búsquedas respecto a la semana anterior';
COMMENT ON COLUMN user_insights_stats.token_usage_percentage IS 'Porcentaje de tokens utilizados respecto al límite';
COMMENT ON COLUMN user_insights_stats.document_growth_percentage IS 'Porcentaje de crecimiento de documentos procesados';