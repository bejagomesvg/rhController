CREATE TABLE IF NOT EXISTS log_table_load (
    id SERIAL PRIMARY KEY,			     -- Identificador único
    registration VARCHAR(50),            -- Nome da tabela que foi inserida as informações
    date_registration TIMESTAMPTZ,       -- Data de Importação
    file_ VARCHAR(50),                   -- Nome completo do funcionário
    user_registration VARCHAR(50)        -- Usuário que registrou
);
