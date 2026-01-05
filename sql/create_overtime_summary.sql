-- View consolidada de Overtime com setor vindo da tabela employee
-- Ajuste nomes de tabelas/colunas conforme seu schema se necessário.

DROP VIEW IF EXISTS overtime_summary;

CREATE OR REPLACE VIEW overtime_summary AS
SELECT
  COALESCE(o.company, e.company) AS company,
  (o.date_)::date AS date_,
  o.registration::numeric AS registration,
  COALESCE(NULLIF(o.name, ''), e.name) AS name,
  e.sector AS sector,
  e.salary AS salary,
  NULLIF(btrim(o.hrs303::text), '')::interval AS hrs303,
  NULLIF(btrim(o.hrs304::text), '')::interval AS hrs304,
  NULLIF(btrim(o.hrs505::text), '')::interval AS hrs505,
  NULLIF(btrim(o.hrs506::text), '')::interval AS hrs506,
  NULLIF(btrim(o.hrs511::text), '')::interval AS hrs511,
  NULLIF(btrim(o.hrs512::text), '')::interval AS hrs512
FROM overtime o
LEFT JOIN employee e ON o.registration = e.registration;

-- Observações:
-- 1) A view não impõe NOT NULL; se precisar de uma tabela física com constraints, substitua por
--    CREATE TABLE overtime_summary AS SELECT ... e adicione constraints/indices.
-- 2) As conversões assumem Postgres; se seu backend usa outro SGDB, ajuste os casts.
-- 3) Rode este script no backend (não no frontend).
