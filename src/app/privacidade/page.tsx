export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold">
            <span className="text-orange-500">BEM</span>
            <span className="text-slate-700"> plantonista</span>
          </a>
          <a href="/login" className="text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors">
            Login →
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
          <p className="text-sm text-gray-400 mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

          <div className="prose prose-gray prose-sm max-w-none space-y-6 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-800">1. Dados Coletados</h2>
              <p>
                Coletamos apenas os dados necessários para o funcionamento do serviço: nome, CRM,
                e-mail, dados de plantões e documentos enviados pelo próprio usuário.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">2. Uso dos Dados</h2>
              <p>
                Seus dados são utilizados exclusivamente para fornecer os serviços da plataforma
                BEM Plantonista. Não compartilhamos, vendemos ou cedemos suas informações a terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">3. Armazenamento e Segurança</h2>
              <p>
                Os dados são armazenados com criptografia em servidores seguros (Supabase) com
                Row Level Security (RLS), garantindo que apenas você acesse suas informações.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">4. Direitos do Usuário</h2>
              <p>
                Você pode solicitar a exclusão completa dos seus dados a qualquer momento
                entrando em contato pelo e-mail suporte@bemplantonista.com.br. Atenderemos
                sua solicitação em até 5 dias úteis.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">5. LGPD</h2>
              <p>
                Esta política está em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                O responsável pelo tratamento de dados é a equipe BEM Plantonista.
              </p>
            </section>

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Nota:</strong> Conteúdo completo a ser revisado por advogado antes da publicação oficial.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
