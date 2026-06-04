-- Tabela para links públicos da carteira digital (compartilhamento sem login)
CREATE TABLE IF NOT EXISTS public.carteira_publica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca rápida por token
CREATE UNIQUE INDEX IF NOT EXISTS idx_carteira_publica_token ON public.carteira_publica (token);
CREATE INDEX IF NOT EXISTS idx_carteira_publica_user ON public.carteira_publica (user_id);

-- RLS: usuário pode criar/ver seus próprios links
ALTER TABLE public.carteira_publica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own carteira links"
  ON public.carteira_publica FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy pública para leitura por token (via service role ou anon com token)
CREATE POLICY "Anyone can read carteira by token"
  ON public.carteira_publica FOR SELECT
  USING (true);
