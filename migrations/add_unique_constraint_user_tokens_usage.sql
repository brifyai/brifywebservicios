-- Agregar restricción UNIQUE para user_id en tabla user_tokens_usage
-- Esto previene múltiples registros para el mismo usuario

-- Primero eliminar duplicados si existen
DELETE FROM user_tokens_usage 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM user_tokens_usage 
    GROUP BY user_id
);

-- Agregar restricción UNIQUE si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_tokens_usage_user_id_key'
    ) THEN
        ALTER TABLE user_tokens_usage 
        ADD CONSTRAINT user_tokens_usage_user_id_key 
        UNIQUE (user_id);
    END IF;
END $$;

-- Comentario explicativo
COMMENT ON CONSTRAINT user_tokens_usage_user_id_key ON user_tokens_usage IS 
'Garantiza que cada usuario tenga solo un registro de uso de tokens';