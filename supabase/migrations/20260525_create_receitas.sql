-- Tabela de receitas extras (consultas, procedimentos, pareceres, etc.)
CREATE TABLE IF NOT EXISTS public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outros',
  recorrente BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own receitas"
  ON public.receitas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice para queries filtradas por user + data
CREATE INDEX IF NOT EXISTS idx_receitas_user_data ON public.receitas (user_id, data DESC);
