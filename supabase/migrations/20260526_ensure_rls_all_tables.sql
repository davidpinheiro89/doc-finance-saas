-- =============================================================================
-- Ensure RLS is enabled on all known tables with proper policies.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- ── hospitals (if exists) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hospitals') THEN
    EXECUTE 'ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "hospitals_user_all" ON public.hospitals';
    -- Check if user_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name = 'user_id') THEN
      EXECUTE 'CREATE POLICY "hospitals_user_all" ON public.hospitals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- ── financial_entries (if exists) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_entries') THEN
    EXECUTE 'ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "financial_entries_user_all" ON public.financial_entries';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_entries' AND column_name = 'user_id') THEN
      EXECUTE 'CREATE POLICY "financial_entries_user_all" ON public.financial_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- ── profiles (if exists) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "profiles_user_all" ON public.profiles';
    -- profiles may use `id` = auth.uid() instead of user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
      EXECUTE 'CREATE POLICY "profiles_user_all" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id') THEN
      EXECUTE 'CREATE POLICY "profiles_user_all" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
    END IF;
  END IF;
END $$;

-- ── Verify: re-enable RLS on core tables (defensive, already done in previous migrations) ──
ALTER TABLE public.plantoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locais_favoritos ENABLE ROW LEVEL SECURITY;
