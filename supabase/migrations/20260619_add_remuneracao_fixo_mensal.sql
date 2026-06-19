-- Adiciona suporte a remuneração "fixo_mensal" para plantões recorrentes.
-- grupo_recorrencia_id: UUID compartilhado por todos os plantões de uma mesma série recorrente.
-- tipo_remuneracao: 'por_plantao' (padrão, comportamento original) ou 'fixo_mensal'.

ALTER TABLE plantoes
  ADD COLUMN IF NOT EXISTS grupo_recorrencia_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_remuneracao text NOT NULL DEFAULT 'por_plantao';

-- Constraint para valores válidos
ALTER TABLE plantoes
  ADD CONSTRAINT chk_tipo_remuneracao
  CHECK (tipo_remuneracao IN ('por_plantao', 'fixo_mensal'));

-- Índice parcial para agrupamento eficiente de séries fixo_mensal
CREATE INDEX IF NOT EXISTS idx_plantoes_grupo_recorrencia
  ON plantoes (grupo_recorrencia_id)
  WHERE grupo_recorrencia_id IS NOT NULL;
