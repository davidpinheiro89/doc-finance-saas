-- A tabela 'documentos' foi criada originalmente com coluna 'url' (NOT NULL),
-- mas o código usa 'arquivo_url'. Renomear para alinhar com o código.

-- Renomear a coluna 'url' para 'arquivo_url' (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documentos' AND column_name = 'url'
  ) THEN
    -- Se arquivo_url já existe (da migration anterior), copiar dados de url para ela
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'documentos' AND column_name = 'arquivo_url'
    ) THEN
      EXECUTE 'UPDATE public.documentos SET arquivo_url = url WHERE arquivo_url IS NULL AND url IS NOT NULL';
      EXECUTE 'ALTER TABLE public.documentos DROP COLUMN url';
    ELSE
      EXECUTE 'ALTER TABLE public.documentos RENAME COLUMN url TO arquivo_url';
    END IF;
  END IF;
END $$;

-- Garantir que arquivo_url existe e remover NOT NULL (arquivo pode ser opcional)
ALTER TABLE public.documentos ALTER COLUMN arquivo_url DROP NOT NULL;
