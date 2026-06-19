-- Adiciona coluna cores_evento (jsonb) na tabela user_settings.
-- Armazena a cor padrão por tipo de evento (plantao, folga, pos-plantao, ferias, personalizado).
-- Formato esperado: {"plantao": "emerald", "folga": "gray", ...}

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS cores_evento jsonb DEFAULT '{}';
