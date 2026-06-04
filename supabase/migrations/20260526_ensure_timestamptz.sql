-- =============================================================================
-- Ensure all timestamp columns across tables use TIMESTAMPTZ (with timezone).
-- Idempotent: ALTER TYPE to same type is a no-op in Postgres.
-- =============================================================================

-- ── plantoes ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plantoes' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone') THEN
    ALTER TABLE public.plantoes ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo';
    RAISE NOTICE 'plantoes.created_at converted to TIMESTAMPTZ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plantoes' AND column_name = 'updated_at'
      AND data_type = 'timestamp without time zone') THEN
    ALTER TABLE public.plantoes ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'America/Sao_Paulo';
    RAISE NOTICE 'plantoes.updated_at converted to TIMESTAMPTZ';
  END IF;
END $$;

-- ── despesas ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'despesas' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone') THEN
    ALTER TABLE public.despesas ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo';
    RAISE NOTICE 'despesas.created_at converted to TIMESTAMPTZ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'despesas' AND column_name = 'updated_at'
      AND data_type = 'timestamp without time zone') THEN
    ALTER TABLE public.despesas ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'America/Sao_Paulo';
    RAISE NOTICE 'despesas.updated_at converted to TIMESTAMPTZ';
  END IF;
END $$;

-- ── locais_favoritos ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locais_favoritos' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone') THEN
    ALTER TABLE public.locais_favoritos ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo';
    RAISE NOTICE 'locais_favoritos.created_at converted to TIMESTAMPTZ';
  END IF;
END $$;

-- ── Set Supabase project timezone to America/Sao_Paulo ──
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';
