CREATE TABLE IF NOT EXISTS employee (
    id INT PRIMARY KEY,                  -- Identificador único do funcionário
    company INT,                         -- Código da empresa
    registration INT,                    -- Número de registro interno do funcionário
    name VARCHAR(150),                   -- Nome completo do funcionário
    cpf VARCHAR(14),                     -- CPF (Cadastro de Pessoa Física - Brasil)
    date_birth DATE,                     -- Data de nascimento
    date_hiring DATE,                    -- Data de contratação
    status INT,                          -- Status do vínculo (0=Inativo, 1=Ativo, 2=Férias, 3=Demitido, etc.)
    date_status DATE,                    -- Data em que o status foi atualizado
    role VARCHAR(100),                   -- Cargo ou função
    sector VARCHAR(100),                 -- Setor ou departamento (Descrição do Local)
    nationality VARCHAR(50),             -- Nacionalidade    
    education VARCHAR(50),               -- Escolaridade
    sex CHAR(1),                         -- Sexo (Masculino/Feminino)
    marital VARCHAR(50),                 -- Estado civil (solteiro, casado, etc.)
    ethnicity VARCHAR(50),               -- Etnia (conforme padrão da empresa)
    salary DECIMAL(10,2),                -- Salário atual
    type_registration VARCHAR(50),       -- Tipo de registro (manual ou exportado)
    user_registration VARCHAR(50),       -- Usuário que registrou
    date_registration DATE               -- Data de registro no sistema
);


/* dados da planilha
planilha: cadastro.xlsx

Empresa
Cadastro
Nome
CPF
Nascimento
Admissão
Situação
Data Afastamento
Título Reduzido (Cargo)
Descrição do Local
Descrição (Nacionalidade)
Descrição (Instrução)
Sexo
Descrição (Estado Civil)
Descrição (Raça/Etnia)
Valor Salário
 */