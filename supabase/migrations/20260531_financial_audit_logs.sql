-- ============================================================================
-- Tabela de auditoria financeira
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON financial_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON financial_audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON financial_audit_logs(created_at DESC);

-- ============================================================================
-- RLS — leitura apenas pelo próprio usuário
-- ============================================================================

ALTER TABLE financial_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON financial_audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sem policy de INSERT/UPDATE/DELETE para usuários — apenas triggers internos escrevem.
-- O service_role (usado pelos triggers) bypassa RLS automaticamente.

-- ============================================================================
-- Função genérica de auditoria
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_financial_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO financial_audit_logs (user_id, table_name, operation, record_id, old_data, new_data)
    VALUES (NEW.user_id, TG_TABLE_NAME, 'INSERT', NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO financial_audit_logs (user_id, table_name, operation, record_id, old_data, new_data)
    VALUES (NEW.user_id, TG_TABLE_NAME, 'UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO financial_audit_logs (user_id, table_name, operation, record_id, old_data, new_data)
    VALUES (OLD.user_id, TG_TABLE_NAME, 'DELETE', OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================================
-- Triggers nas tabelas financeiras
-- ============================================================================

-- financial_entries
DROP TRIGGER IF EXISTS trg_audit_financial_entries ON financial_entries;
CREATE TRIGGER trg_audit_financial_entries
  AFTER INSERT OR UPDATE OR DELETE ON financial_entries
  FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

-- despesas
DROP TRIGGER IF EXISTS trg_audit_despesas ON despesas;
CREATE TRIGGER trg_audit_despesas
  AFTER INSERT OR UPDATE OR DELETE ON despesas
  FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();
