# BEM plantonista

Sistema de gestão de plantonistas médicos com autenticação via Supabase.

## Instalação

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente no arquivo `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://bbskqxdvfnkvmyqjrzfd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_-V4n0wOmJtuCqfPri-HkYQ_6wwv_t-O
```

3. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

4. Acesse a aplicação em `http://localhost:3000/login`

## Estrutura do Projeto

- `src/app/login/page.tsx` - Página de login com design minimalista
- `src/lib/supabase.ts` - Cliente Supabase configurado
- `.env.local` - Variáveis de ambiente (já configuradas)

## Funcionalidades

- Autenticação com Supabase
- Design responsivo com Tailwind CSS
- Identidade visual BEM plantonista
- Validação de formulário
- Tratamento de erros
