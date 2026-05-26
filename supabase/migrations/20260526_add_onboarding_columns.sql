-- Add onboarding flag and profile fields to user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS especialidade TEXT,
  ADD COLUMN IF NOT EXISTS valor_medio_plantao NUMERIC,
  ADD COLUMN IF NOT EXISTS plantoes_por_mes TEXT;
