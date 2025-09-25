-- Migración de precios de USD a CLP
-- Este script cambia la estructura de las tablas para usar pesos chilenos en lugar de dólares

-- Tasa de cambio: 1 USD = 950 CLP (aproximadamente)

BEGIN;

-- =====================================================
-- 1. MIGRAR TABLA EXTENSIONES
-- =====================================================

-- Agregar nueva columna price_clp
ALTER TABLE public.extensiones 
ADD COLUMN IF NOT EXISTS price_clp DECIMAL(12,2) DEFAULT 0.00;

-- Convertir valores de USD a CLP (1 USD = 950 CLP)
UPDATE public.extensiones 
SET price_clp = ROUND(price_usd * 950, 2)
WHERE price_usd IS NOT NULL;

-- Eliminar la columna antigua price_usd
ALTER TABLE public.extensiones 
DROP COLUMN IF EXISTS price_usd;

-- Renombrar price_clp a price para mantener simplicidad
ALTER TABLE public.extensiones 
RENAME COLUMN price_clp TO price;

-- Agregar comentario para documentar la moneda
COMMENT ON COLUMN public.extensiones.price IS 'Precio en pesos chilenos (CLP)';

-- =====================================================
-- 2. MIGRAR TABLA PLANS (si existe)
-- =====================================================

-- Verificar si la tabla plans existe y tiene columna price_usd
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND column_name = 'price_usd'
        AND table_schema = 'public'
    ) THEN
        -- Agregar nueva columna price_clp
        ALTER TABLE public.plans 
        ADD COLUMN IF NOT EXISTS price_clp DECIMAL(12,2) DEFAULT 0.00;
        
        -- Convertir valores de USD a CLP
        UPDATE public.plans 
        SET price_clp = ROUND(price_usd * 950, 2)
        WHERE price_usd IS NOT NULL;
        
        -- Eliminar la columna antigua
        ALTER TABLE public.plans 
        DROP COLUMN price_usd;
        
        -- Renombrar a price
        ALTER TABLE public.plans 
        RENAME COLUMN price_clp TO price;
        
        -- Agregar comentario
        COMMENT ON COLUMN public.plans.price IS 'Precio en pesos chilenos (CLP)';
        
        RAISE NOTICE 'Tabla plans migrada exitosamente de USD a CLP';
    ELSE
        RAISE NOTICE 'Tabla plans no encontrada o no tiene columna price_usd';
    END IF;
END $$;

-- =====================================================
-- 3. ACTUALIZAR FUNCIONES QUE USAN price_usd
-- =====================================================

-- Actualizar función get_plan_extensions si existe
DROP FUNCTION IF EXISTS get_plan_extensions(UUID, UUID);

CREATE OR REPLACE FUNCTION get_plan_extensions(plan_uuid UUID, user_uuid UUID)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    name_es TEXT,
    description TEXT,
    description_es TEXT,
    price DECIMAL,
    storage_bonus_bytes BIGINT,
    disponible BOOLEAN,
    user_has_extension BOOLEAN
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
        e.price,  -- Ahora en CLP
        e.storage_bonus_bytes,
        e.disponible,
        CASE 
            WHEN pe.extension_id IS NOT NULL THEN true 
            ELSE false 
        END as user_has_extension
    FROM public.extensiones e
    LEFT JOIN public.plan_extensiones pe ON e.id = pe.extension_id 
        AND pe.user_id = user_uuid 
        AND pe.active = true
    WHERE e.disponible = true
    ORDER BY e.price ASC;
END;
$$;

-- Actualizar función calculate_plan_total_price si existe
DROP FUNCTION IF EXISTS calculate_plan_total_price(UUID, UUID);

CREATE OR REPLACE FUNCTION calculate_plan_total_price(plan_uuid UUID, user_uuid UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
    base_price DECIMAL := 0;
    extensions_price DECIMAL := 0;
    is_free_trial BOOLEAN := false;
BEGIN
    -- Obtener precio base del plan y si es prueba gratis
    SELECT COALESCE(p.price, 0), COALESCE(p.prueba_gratis, false)
    INTO base_price, is_free_trial
    FROM public.plans p
    WHERE p.id = plan_uuid;
    
    -- Si es prueba gratis, el precio base es 0
    IF is_free_trial THEN
        base_price := 0;
    END IF;
    
    -- Calcular precio de extensiones activas
    SELECT COALESCE(SUM(e.price), 0.00)  -- Ahora en CLP
    INTO extensions_price
    FROM public.plan_extensiones pe
    JOIN public.extensiones e ON pe.extension_id = e.id
    WHERE pe.user_id = user_uuid 
    AND pe.plan_id = plan_uuid 
    AND pe.active = true;
    
    RETURN base_price + extensions_price;
END;
$$;

-- =====================================================
-- 4. VERIFICAR CAMBIOS
-- =====================================================

-- Mostrar estructura actualizada de extensiones
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'extensiones' 
AND table_schema = 'public'
AND column_name IN ('price', 'price_clp', 'price_usd')
ORDER BY column_name;

-- Mostrar algunos precios convertidos
SELECT 
    id,
    name_es,
    price as price_clp,
    CONCAT('$', TO_CHAR(price, 'FM999,999,999')) as formatted_price
FROM public.extensiones 
ORDER BY price ASC
LIMIT 10;

COMMIT;

-- Mensaje final
SELECT 'Migración completada: Precios convertidos de USD a CLP (1 USD = 950 CLP)' as resultado;