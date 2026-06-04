export default function TermosPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
          <p className="text-sm text-gray-400 mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

          <div className="prose prose-gray prose-sm max-w-none space-y-6 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-800">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar a plataforma BEM Plantonista, você concorda com estes Termos de Uso.
                Caso não concorde, não utilize o serviço.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">2. Descrição do Serviço</h2>
              <p>
                O BEM Plantonista é uma plataforma de gestão financeira e de escalas voltada para médicos
                plantonistas, oferecendo controle de plantões, faturamento, documentos e estimativas fiscais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">3. Cadastro e Responsabilidades</h2>
              <p>
                O usuário é responsável pela veracidade das informações fornecidas no cadastro e pela
                segurança de suas credenciais de acesso.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">4. Pagamento e Cancelamento</h2>
              <p>
                O serviço é oferecido mediante assinatura mensal. O cancelamento pode ser solicitado
                a qualquer momento, sem multa ou fidelidade. Oferecemos garantia de 7 dias com
                reembolso integral.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800">5. Limitação de Responsabilidade</h2>
              <p>
                As estimativas fiscais fornecidas pelo sistema são meramente informativas e não
                substituem orientação contábil ou jurídica profissional.
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
