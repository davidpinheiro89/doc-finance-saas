-- Add prazo_pagamento_dias field to plantoes table
ALTER TABLE plantoes ADD COLUMN IF NOT EXISTS prazo_pagamento_dias INTEGER DEFAULT 30;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_plantoes_prazo_pagamento ON plantoes(prazo_pagamento_dias);

-- Add comment for documentation
COMMENT ON COLUMN plantoes.prazo_pagamento_dias IS 'Payment deadline in days after plantão date';
