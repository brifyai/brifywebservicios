-- Agregar restricción UNIQUE para user_id en tabla user_credentials
-- Esto previene múltiples registros para el mismo usuario

-- Primero eliminar duplicados si existen
DELETE FROM user_credentials 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM user_credentials 
    GROUP BY user_id
);

-- Agregar restricción UNIQUE
ALTER TABLE user_credentials 
ADD CONSTRAINT unique_user_credentials_user_id 
UNIQUE (user_id);

-- Comentario explicativo
COMMENT ON CONSTRAINT unique_user_credentials_user_id ON user_credentials IS 
'Garantiza que cada usuario tenga solo un registro de credenciales de Google Drive';