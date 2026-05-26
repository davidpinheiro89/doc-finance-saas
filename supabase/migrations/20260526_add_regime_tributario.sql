-- Add regime_tributario column to user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS regime_tributario TEXT NOT NULL DEFAULT 'pessoa_fisica';
