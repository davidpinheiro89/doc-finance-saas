ALTER TABLE plantoes ADD COLUMN IF NOT EXISTS turno TEXT;

-- CHECK constraint (may already exist in DB as plantoes_turno_check)
DO $$ BEGIN
  ALTER TABLE plantoes ADD CONSTRAINT plantoes_turno_check CHECK (turno IN ('diurno', 'noturno'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
