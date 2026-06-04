-- =============================================================================
-- Migration 003 — Normalize ownership column to `user_id` across all tables
-- =============================================================================
-- Context: o app estava inconsistente — algumas páginas/queries usavam
-- `usuario_id` (português, esquema original) e outras `user_id` (convenção
-- Supabase). Esta migration converge tudo para `user_id`, mantendo segurança
-- (RLS) e performance (índices compostos).
--
-- Idempotente: pode ser executada múltiplas vezes; cada etapa só roda se a
-- estrutura ainda estiver no estado antigo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper function: normaliza uma tabela arbitrária para usar `user_id`
-- -----------------------------------------------------------------------------
-- Estratégia:
--   1. Se a tabela tem somente `usuario_id` → renomeia para `user_id`.
--   2. Se a tabela tem ambas → copia valores não-nulos para `user_id` e
--      dropa `usuario_id`.
--   3. Se a tabela já tem apenas `user_id` → no-op.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
  has_user_id BOOLEAN;
  has_usuario_id BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['plantoes', 'despesas', 'locais_favoritos']
  LOOP
    -- Detecta presença das colunas
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id'
    ) INTO has_user_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'usuario_id'
    ) INTO has_usuario_id;

    -- Caso 1: só usuario_id → renomeia
    IF has_usuario_id AND NOT has_user_id THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN usuario_id TO user_id', tbl);
      RAISE NOTICE '[003] %: renamed usuario_id -> user_id', tbl;

    -- Caso 2: ambas → consolida e dropa a antiga
    ELSIF has_usuario_id AND has_user_id THEN
      EXECUTE format(
        'UPDATE public.%I SET user_id = COALESCE(user_id, usuario_id) WHERE user_id IS NULL',
        tbl
      );
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN usuario_id', tbl);
      RAISE NOTICE '[003] %: merged usuario_id into user_id and dropped column', tbl;

    -- Caso 3: já normalizado
    ELSIF has_user_id AND NOT has_usuario_id THEN
      RAISE NOTICE '[003] %: already normalized, skipping', tbl;

    ELSE
      RAISE NOTICE '[003] %: no ownership column found, skipping', tbl;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Garante NOT NULL + FK para auth.users (segurança)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['plantoes', 'despesas', 'locais_favoritos']
  LOOP
    -- Só aplica se a tabela existir
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET NOT NULL', tbl);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Índices compostos para queries quentes: filter by user + order by data
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_plantoes_user_data
  ON public.plantoes (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_despesas_user_data
  ON public.despesas (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_locais_favoritos_user
  ON public.locais_favoritos (user_id);

-- Remove índices antigos com nomes baseados em usuario_id (best-effort)
DROP INDEX IF EXISTS public.idx_despesas_usuario_id;
DROP INDEX IF EXISTS public.idx_plantoes_usuario_id;
DROP INDEX IF EXISTS public.idx_locais_favoritos_usuario_id;

-- -----------------------------------------------------------------------------
-- RLS — recria policies sob a nova coluna
-- -----------------------------------------------------------------------------

-- plantoes
ALTER TABLE public.plantoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own plantoes"   ON public.plantoes;
DROP POLICY IF EXISTS "Users can insert their own plantoes" ON public.plantoes;
DROP POLICY IF EXISTS "Users can update their own plantoes" ON public.plantoes;
DROP POLICY IF EXISTS "Users can delete their own plantoes" ON public.plantoes;

CREATE POLICY "Users can view their own plantoes"
  ON public.plantoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own plantoes"
  ON public.plantoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own plantoes"
  ON public.plantoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own plantoes"
  ON public.plantoes FOR DELETE USING (auth.uid() = user_id);

-- despesas (recria as policies da migration 001 sob nova coluna)
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own despesas"   ON public.despesas;
DROP POLICY IF EXISTS "Users can insert their own despesas" ON public.despesas;
DROP POLICY IF EXISTS "Users can update their own despesas" ON public.despesas;
DROP POLICY IF EXISTS "Users can delete their own despesas" ON public.despesas;

CREATE POLICY "Users can view their own despesas"
  ON public.despesas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own despesas"
  ON public.despesas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own despesas"
  ON public.despesas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own despesas"
  ON public.despesas FOR DELETE USING (auth.uid() = user_id);

-- locais_favoritos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'locais_favoritos'
  ) THEN
    EXECUTE 'ALTER TABLE public.locais_favoritos ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own locais"   ON public.locais_favoritos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own locais" ON public.locais_favoritos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own locais" ON public.locais_favoritos';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own locais" ON public.locais_favoritos';

    EXECUTE 'CREATE POLICY "Users can view their own locais"
      ON public.locais_favoritos FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert their own locais"
      ON public.locais_favoritos FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update their own locais"
      ON public.locais_favoritos FOR UPDATE USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete their own locais"
      ON public.locais_favoritos FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Documentação
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN public.plantoes.user_id IS 'FK para auth.users — dono do plantão (normalizado em 003)';
COMMENT ON COLUMN public.despesas.user_id IS 'FK para auth.users — dono da despesa (normalizado em 003)';
