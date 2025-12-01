-- Crear tabla para almacenar resúmenes semanales de insights de IA
CREATE TABLE IF NOT EXISTS weekly_summaries (
    id SERIAL PRIMARY KEY,
    usuario_email VARCHAR(255) NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    
    -- Estadísticas de la semana
    total_searches INTEGER DEFAULT 0,
    semantic_searches INTEGER DEFAULT 0,
    chat_conversations INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    documents_processed INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    
    -- Crecimiento comparado con semana anterior
    search_growth INTEGER DEFAULT 0, -- Porcentaje de crecimiento
    token_growth INTEGER DEFAULT 0,
    document_growth INTEGER DEFAULT 0,
    
    -- Insights y recomendaciones (JSON)
    insights JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_email ON weekly_summaries(usuario_email);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week_start ON weekly_summaries(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week ON weekly_summaries(usuario_email, week_start_date);

-- Índice único para evitar duplicados por usuario y semana
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_summaries_unique_user_week 
ON weekly_summaries(usuario_email, week_start_date);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_weekly_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_weekly_summaries_updated_at
    BEFORE UPDATE ON weekly_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_weekly_summaries_updated_at();

-- Función para obtener resúmenes semanales de un usuario
CREATE OR REPLACE FUNCTION get_user_weekly_summaries(
    p_usuario_email VARCHAR(255),
    p_limit INTEGER DEFAULT 4
)
RETURNS TABLE (
    id INTEGER,
    week_start_date DATE,
    week_end_date DATE,
    total_searches INTEGER,
    semantic_searches INTEGER,
    chat_conversations INTEGER,
    tokens_used INTEGER,
    documents_processed INTEGER,
    documents_uploaded INTEGER,
    search_growth INTEGER,
    token_growth INTEGER,
    document_growth INTEGER,
    insights JSONB,
    recommendations JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ws.id,
        ws.week_start_date,
        ws.week_end_date,
        ws.total_searches,
        ws.semantic_searches,
        ws.chat_conversations,
        ws.tokens_used,
        ws.documents_processed,
        ws.documents_uploaded,
        ws.search_growth,
        ws.token_growth,
        ws.document_growth,
        ws.insights,
        ws.recommendations,
        ws.created_at
    FROM weekly_summaries ws
    WHERE ws.usuario_email = p_usuario_email
    ORDER BY ws.week_start_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Función para insertar o actualizar resumen semanal
CREATE OR REPLACE FUNCTION upsert_weekly_summary(
    p_usuario_email VARCHAR(255),
    p_week_start_date DATE,
    p_week_end_date DATE,
    p_total_searches INTEGER,
    p_semantic_searches INTEGER,
    p_chat_conversations INTEGER,
    p_tokens_used INTEGER,
    p_documents_processed INTEGER,
    p_documents_uploaded INTEGER,
    p_search_growth INTEGER,
    p_token_growth INTEGER,
    p_document_growth INTEGER,
    p_insights JSONB,
    p_recommendations JSONB
)
RETURNS INTEGER AS $$
DECLARE
    summary_id INTEGER;
BEGIN
    INSERT INTO weekly_summaries (
        usuario_email,
        week_start_date,
        week_end_date,
        total_searches,
        semantic_searches,
        chat_conversations,
        tokens_used,
        documents_processed,
        documents_uploaded,
        search_growth,
        token_growth,
        document_growth,
        insights,
        recommendations
    ) VALUES (
        p_usuario_email,
        p_week_start_date,
        p_week_end_date,
        p_total_searches,
        p_semantic_searches,
        p_chat_conversations,
        p_tokens_used,
        p_documents_processed,
        p_documents_uploaded,
        p_search_growth,
        p_token_growth,
        p_document_growth,
        p_insights,
        p_recommendations
    )
    ON CONFLICT (usuario_email, week_start_date)
    DO UPDATE SET
        week_end_date = EXCLUDED.week_end_date,
        total_searches = EXCLUDED.total_searches,
        semantic_searches = EXCLUDED.semantic_searches,
        chat_conversations = EXCLUDED.chat_conversations,
        tokens_used = EXCLUDED.tokens_used,
        documents_processed = EXCLUDED.documents_processed,
        documents_uploaded = EXCLUDED.documents_uploaded,
        search_growth = EXCLUDED.search_growth,
        token_growth = EXCLUDED.token_growth,
        document_growth = EXCLUDED.document_growth,
        insights = EXCLUDED.insights,
        recommendations = EXCLUDED.recommendations,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO summary_id;
    
    RETURN summary_id;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener usuarios activos en la última semana
CREATE OR REPLACE FUNCTION get_active_users_last_week()
RETURNS TABLE (
    usuario_email VARCHAR(255),
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        uis.usuario_email,
        MAX(uis.updated_at) as last_activity
    FROM user_insights_stats uis
    WHERE uis.updated_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY uis.usuario_email
    ORDER BY last_activity DESC;
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON TABLE weekly_summaries IS 'Almacena resúmenes semanales automáticos de insights de IA para cada usuario';
COMMENT ON COLUMN weekly_summaries.insights IS 'Array JSON con insights automáticos generados para la semana';
COMMENT ON COLUMN weekly_summaries.recommendations IS 'Array JSON con recomendaciones personalizadas basadas en el uso';
COMMENT ON FUNCTION get_user_weekly_summaries IS 'Obtiene los resúmenes semanales más recientes de un usuario';
COMMENT ON FUNCTION upsert_weekly_summary IS 'Inserta o actualiza un resumen semanal para un usuario';
COMMENT ON FUNCTION get_active_users_last_week IS 'Obtiene usuarios que han tenido actividad en la última semana';