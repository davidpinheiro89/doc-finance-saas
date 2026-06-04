-- Adiciona colunas faltantes na tabela documentos.
-- Se a tabela não existir, cria do zero.

CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outro',
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tipo TEXT,
  arquivo_tamanho BIGINT,
  validade DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Caso a tabela já exista mas faltem colunas (TODAS as colunas que o código usa):
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'outro';
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS arquivo_url TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS arquivo_nome TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS arquivo_tipo TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS arquivo_tamanho BIGINT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS validade DATE;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- RLS (idempotente)
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documentos' AND policyname = 'Users can manage their own documentos'
  ) THEN
    CREATE POLICY "Users can manage their own documentos"
      ON public.documentos FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Índice
CREATE INDEX IF NOT EXISTS idx_documentos_user ON public.documentos (user_id);
