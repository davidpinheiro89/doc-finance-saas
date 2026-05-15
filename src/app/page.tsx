import { redirect } from 'next/navigation'

/**
 * Página raiz do BEM Plantonista.
 *
 * Esta página não renderiza conteúdo — apenas redireciona o usuário
 * para a rota apropriada baseada no estado de autenticação.
 *
 * O middleware.ts já lida com a lógica de redirecionamento, então
 * esta página serve como fallback caso o middleware não intercepte.
 */

export default function RootPage() {
  redirect('/login')
}
