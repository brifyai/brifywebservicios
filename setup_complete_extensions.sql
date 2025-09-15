-- =====================================================
-- SISTEMA COMPLETO DE EXTENSIONES PARA PLANES
-- =====================================================
-- Ejecutar este SQL en el panel de Supabase

-- 1. Crear tabla de extensiones
CREATE TABLE IF NOT EXISTS public.extensiones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_es TEXT NOT NULL,
    description TEXT,
    description_es TEXT,
    price_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    storage_bonus_bytes BIGINT DEFAULT 0,
    disponible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear tabla de relación plan-extensiones
CREATE TABLE IF NOT EXISTS public.plan_extensiones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    extension_id TEXT NOT NULL REFERENCES public.extensiones(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(plan_id, extension_id, user_id)
);

-- 3. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_extensiones_disponible ON public.extensiones(disponible);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_plan_id ON public.plan_extensiones(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_user_id ON public.plan_extensiones(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_extension_id ON public.plan_extensiones(extension_id);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.extensiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_extensiones ENABLE ROW LEVEL SECURITY;



-- 7. Insertar datos de ejemplo de extensiones
INSERT INTO public.extensiones (id, name, name_es, description, description_es, price_usd, storage_bonus_bytes, disponible) VALUES
('1', 'Extra Storage', 'Almacenamiento Extra', 'Additional 500MB storage space', 'Espacio adicional de 500MB de almacenamiento', 1500.00, 524288000, true),
('2', 'Premium Support', 'Soporte Premium', 'Priority customer support with 24/7 availability', 'Soporte prioritario al cliente con disponibilidad 24/7', 2000.00, 0, true),
('3', 'Advanced Analytics', 'Análisis Avanzado', 'Detailed analytics and reporting features', 'Funciones detalladas de análisis e informes', 2500.00, 0, true),
('4', 'API Access', 'Acceso API', 'Full API access for integrations', 'Acceso completo a API para integraciones', 3000.00, 0, false),
('5', 'Custom Branding', 'Marca Personalizada', 'Remove branding and add your own logo', 'Eliminar marca y agregar tu propio logo', 1800.00, 0, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_es = EXCLUDED.name_es,
    description = EXCLUDED.description,
    description_es = EXCLUDED.description_es,
    price_usd = EXCLUDED.price_usd,
    storage_bonus_bytes = EXCLUDED.storage_bonus_bytes,
    disponible = EXCLUDED.disponible,
    updated_at = timezone('utc'::text, now());

-- 8. Crear función para obtener extensiones de un plan
CREATE OR REPLACE FUNCTION get_plan_extensions(plan_uuid UUID, user_uuid UUID)
RETURNS TABLE (
    extension_id TEXT,
    name TEXT,
    name_es TEXT,
    description TEXT,
    description_es TEXT,
    price_usd DECIMAL,
    storage_bonus_bytes BIGINT,
    disponible BOOLEAN,
    is_selected BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.name,
        e.name_es,
        e.description,
        e.description_es,
        e.price_usd,
        e.storage_bonus_bytes,
        e.disponible,
        CASE WHEN pe.extension_id IS NOT NULL THEN true ELSE false END as is_selected
    FROM public.extensiones e
    LEFT JOIN public.plan_extensiones pe ON e.id = pe.extension_id 
        AND pe.plan_id = plan_uuid 
        AND pe.user_id = user_uuid
    ORDER BY e.price_usd ASC;
END;
$$;

-- 9. Crear función para calcular precio total de un plan con extensiones
CREATE OR REPLACE FUNCTION calculate_plan_total_price(plan_uuid UUID, user_uuid UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
    base_price DECIMAL;
    extensions_price DECIMAL;
    is_free_trial BOOLEAN;
BEGIN
    -- Obtener precio base y si es prueba gratis
    SELECT p.price_usd, p.prueba_gratis
    INTO base_price, is_free_trial
    FROM public.plans p
    WHERE p.id = plan_uuid;
    
    -- Si es prueba gratis, retornar 0
    IF is_free_trial THEN
        RETURN 0;
    END IF;
    
    -- Calcular precio de extensiones seleccionadas
    SELECT COALESCE(SUM(e.price_usd), 0)
    INTO extensions_price
    FROM public.plan_extensiones pe
    JOIN public.extensiones e ON pe.extension_id = e.id
    WHERE pe.plan_id = plan_uuid 
        AND pe.user_id = user_uuid
        AND e.disponible = true;
    
    RETURN COALESCE(base_price, 0) + COALESCE(extensions_price, 0);
END;
$$;
