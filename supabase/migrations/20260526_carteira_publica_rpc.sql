-- Função pública para buscar documentos via token da carteira pública.
-- SECURITY DEFINER para bypassar RLS da tabela documentos.
CREATE OR REPLACE FUNCTION public.get_carteira_publica(p_token UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  categoria TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  validade DATE,
  notas TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Buscar o link pelo token
  SELECT cp.user_id, cp.expires_at
    INTO v_user_id, v_expires_at
    FROM carteira_publica cp
   WHERE cp.token = p_token
   LIMIT 1;

  -- Se não encontrou, retorna vazio
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Se expirou, retorna vazio
  IF v_expires_at < now() THEN
    RETURN;
  END IF;

  -- Retornar documentos do usuário
  RETURN QUERY
    SELECT d.id, d.nome, d.categoria, d.arquivo_url, d.arquivo_nome, d.validade, d.notas
      FROM documentos d
     WHERE d.user_id = v_user_id
     ORDER BY d.created_at DESC;
END;
$$;
