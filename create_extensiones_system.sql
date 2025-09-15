-- Crear tabla de extensiones
CREATE TABLE IF NOT EXISTS extensiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_es VARCHAR(255) NOT NULL,
    description TEXT,
    description_es TEXT,
    price_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    extension_code VARCHAR(100) UNIQUE NOT NULL,
    service_type VARCHAR(50) NOT NULL DEFAULT 'entrenador',
    disponible BOOLEAN NOT NULL DEFAULT true,
    storage_extra_bytes BIGINT DEFAULT 0,
    token_extra_usage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de relación entre planes y extensiones seleccionadas por usuarios
CREATE TABLE IF NOT EXISTS plan_extensiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    extension_id UUID NOT NULL REFERENCES extensiones(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, plan_id, extension_id)
);

-- Insertar extensiones de ejemplo
INSERT INTO extensiones (name, name_es, description, description_es, price_usd, extension_code, service_type, disponible, storage_extra_bytes, token_extra_usage) VALUES
('Extra Storage 1GB', 'Almacenamiento Extra 1GB', 'Additional 1GB of storage space', 'Espacio adicional de almacenamiento de 1GB', 10.00, 'storage_1gb', 'entrenador', true, 1073741824, 0),
('Extra Storage 5GB', 'Almacenamiento Extra 5GB', 'Additional 5GB of storage space', 'Espacio adicional de almacenamiento de 5GB', 40.00, 'storage_5gb', 'entrenador', true, 5368709120, 0),
('Premium Tokens', 'Tokens Premium', 'Additional 1M tokens for AI processing', 'Tokens adicionales de 1M para procesamiento IA', 25.00, 'tokens_1m', 'entrenador', true, 0, 1000000),
('Advanced Analytics', 'Analíticas Avanzadas', 'Advanced analytics and reporting features', 'Funciones avanzadas de analíticas e informes', 15.00, 'analytics_advanced', 'entrenador', true, 0, 0),
('Priority Support', 'Soporte Prioritario', '24/7 priority customer support', 'Soporte al cliente prioritario 24/7', 20.00, 'support_priority', 'entrenador', true, 0, 0),
('API Access', 'Acceso API', 'Full API access for integrations', 'Acceso completo a API para integraciones', 30.00, 'api_access', 'entrenador', false, 0, 0),
('Custom Branding', 'Marca Personalizada', 'Custom branding and white-label options', 'Opciones de marca personalizada y etiqueta blanca', 50.00, 'custom_branding', 'entrenador', true, 0, 0),
('Multi-User Access', 'Acceso Multi-Usuario', 'Support for up to 10 team members', 'Soporte para hasta 10 miembros del equipo', 35.00, 'multi_user_10', 'entrenador', true, 0, 0);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_extensiones_service_type ON extensiones(service_type);
CREATE INDEX IF NOT EXISTS idx_extensiones_disponible ON extensiones(disponible);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_user_id ON plan_extensiones(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_plan_id ON plan_extensiones(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_active ON plan_extensiones(active);

-- Función para calcular el precio total de un plan con extensiones
CREATE OR REPLACE FUNCTION calculate_plan_total_price(p_user_id UUID, p_plan_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    base_price DECIMAL(10,2);
    extensions_price DECIMAL(10,2);
    is_free_trial BOOLEAN;
BEGIN
    -- Obtener precio base del plan y si es prueba gratis
    SELECT price_usd, COALESCE(prueba_gratis, false)
    INTO base_price, is_free_trial
    FROM plans 
    WHERE id = p_plan_id;
    
    -- Si es prueba gratis, el precio total es 0
    IF is_free_trial THEN
        RETURN 0.00;
    END IF;
    
    -- Calcular precio de extensiones activas
    SELECT COALESCE(SUM(e.price_usd), 0.00)
    INTO extensions_price
    FROM plan_extensiones pe
    JOIN extensiones e ON pe.extension_id = e.id
    WHERE pe.user_id = p_user_id 
      AND pe.plan_id = p_plan_id 
      AND pe.active = true
      AND e.disponible = true;
    
    RETURN COALESCE(base_price, 0.00) + COALESCE(extensions_price, 0.00);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener extensiones disponibles para un tipo de servicio
CREATE OR REPLACE FUNCTION get_available_extensions(p_service_type VARCHAR(50) DEFAULT 'entrenador')
RETURNS TABLE(
    id UUID,
    name VARCHAR(255),
    name_es VARCHAR(255),
    description TEXT,
    description_es TEXT,
    price_usd DECIMAL(10,2),
    extension_code VARCHAR(100),
    disponible BOOLEAN,
    storage_extra_bytes BIGINT,
    token_extra_usage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.name,
        e.name_es,
        e.description,
        e.description_es,
        e.price_usd,
        e.extension_code,
        e.disponible,
        e.storage_extra_bytes,
        e.token_extra_usage
    FROM extensiones e
    WHERE e.service_type = p_service_type
    ORDER BY e.disponible DESC, e.price_usd ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener extensiones activas de un usuario para un plan
CREATE OR REPLACE FUNCTION get_user_plan_extensions(p_user_id UUID, p_plan_id UUID)
RETURNS TABLE(
    extension_id UUID,
    name VARCHAR(255),
    name_es VARCHAR(255),
    price_usd DECIMAL(10,2),
    extension_code VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.name,
        e.name_es,
        e.price_usd,
        e.extension_code
    FROM plan_extensiones pe
    JOIN extensiones e ON pe.extension_id = e.id
    WHERE pe.user_id = p_user_id 
      AND pe.plan_id = p_plan_id 
      AND pe.active = true
      AND e.disponible = true
    ORDER BY e.name;
END;
$$ LANGUAGE plpgsql;

COMMIT;