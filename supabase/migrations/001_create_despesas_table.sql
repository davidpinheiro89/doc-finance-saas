-- Create despesas table for expense tracking
CREATE TABLE IF NOT EXISTS despesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  categoria VARCHAR(50) DEFAULT 'outros',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_despesas_usuario_id ON despesas(usuario_id);
CREATE INDEX idx_despesas_data ON despesas(data);

-- Enable RLS (Row Level Security)
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can view their own despesas" ON despesas
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert their own despesas" ON despesas
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own despesas" ON despesas
  FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete their own despesas" ON despesas
  FOR DELETE USING (auth.uid() = usuario_id);
