[33mf6615306[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m fix: correct Sidebar props on escala page
[33ma5e4ae12[m fix: correct supabase import to default export
[33mf3c92f91[m fix: correct supabase import path on escala page
[33mc331c2c2[m feat: add confirmation logic for day actions on escala
[33m4aeccc32[m feat(escala): series modal for edit/delete - ask 'just this one' or 'all in series'
[33mb77a7f1f[m fix: replicate plantão to subsequent weeks when editing with recurrence enabled
[33m1a0f9f25[m fix(escala): use 'dia'/'noite' for turno values to match DB constraint
[33m662fa9af[m fix(escala): use lowercase turno values ('diurno'/'noturno') to match DB check constraint
[33mec1fb88b[m feat(escala): add turno field (Diurno/Noturno) to plantao form, DB, and WhatsApp message
[33m5953ceb5[m feat(escala): add especialidade and setor to WhatsApp share message
[33mcf1f8067[m fix: update WhatsApp share link to bemplantonista.com.br
[33m25f9079c[m fix(escala): rewrite WhatsApp share message with ASCII-safe separators to prevent truncation
[33m9990a4b4[m fix(escala): make duration field required and clarify placeholder to 'Ex: 12'
[33m02186961[m fix(escala): separate folgas from plantões in month stats counters
[33ma2fa76d3[m fix(escala): correct month capitalization 'Maio de 2026' instead of 'Maio De 2026'
[33m4f6da3cd[m fix: standardize hours formatting — no unnecessary decimals (12.0h → 12h, 6.5h stays 6.5h)
[33m200d92d0[m fix: show Escala summary cards on mobile portrait — compact row always visible below header
[33m6d2a782d[m feat: subscription gate on Dashboard — block access if subscription_status != 'active', show premium Acesso Restrito screen
[33md879a7ed[m feat: edit shift inline — Editar button in action modal, form pre-fill, Supabase .update() by ID
[33mc8d03bb4[m feat: Passar Plantão — WhatsApp share with privacy toggles and growth referral link
[33md8ed9d76[m feat: custom block types with color picker — Folga, Pós-Plantão, Férias, Personalizado with dynamic calendar colors
[33m41c9024a[m feat: mobile-extreme responsiveness — compact calendar, drawer modals, larger touch targets, skeleton loading
[33md2074b5f[m feat: multi-plantão stacking + recurrence batch insert with preview UI
[33m7ddca01a[m feat: premium delete confirmation modal with plantão details before clearing day
[33m53fc7c18[m feat: schedule conflict detection with confirmation modal before adding duplicate plantões
[33mb4a6a7dc[m feat: interactive monthly calendar for Escala page with event rendering, day states, and premium UI
[33m98fa1247[m fix: mobile drawer menu, escala user_id bug, timezone-safe date comparison
[33m08b4fefa[m fix: corrige conversão UTC nas datas — centraliza em date-utils.ts
[33mec4b9181[m ui: restaura textos da sidebar e fixa largura do menu
[33m91797b8d[m feat: performance, skeletons e seguranca
[33m1f5a500a[m fix: implementar estado isSidebarOpen e botão de menu mobile
[33mb80449e7[m fix: aplicar Mobile First - header mobile e estrutura corrigida
[33mbb148808[m fix: corrigir erro handleLogout e aplicar Mobile First structural
[33m6fedf4d3[m fix: otimizar mobile - sidebar com 80% largura e padding respiratório
[33m56ac0df7[m fix: corrigir interface mobile - sidebar responsiva com overlay e viewport
[33m49dbe4c5[m remove: remover gráfico 'Eficiência por Hospital' para estabilizar piloto
[33m2049d597[m fix: melhorar layout do gráfico - barras horizontais com formatação correta
[33m10173c06[m security: corrigir falha crítica de privacidade - adicionar user_id em todas as queries
[33mb90ed232[m real: implementar gráfico com dados reais e sanitização numérica
[33m9c414fb9[m structural: aplicar teste visual com container colorido para debug
[33m733caa13[m senior: aplicar hardcoded test data para sanity check do gráfico
[33m9079ff68[m zero: reconstruir gráfico com lógica blindada e dados de memória
[33ma493db0c[m reboot: reconstruir gráfico de eficiência com lógica blindada
[33mf380dc6e[m feat: implementar gráfico de eficiência simples usando dados de plantões
[33m760ad90b[m fix: remover query de tabela inexistente e usar dados de plantões em memória
[33mc4cb8b3a[m fix: sanitização de dados de emergência para gráfico de eficiência
[33ma6ec15f3[m fix: solução definitiva para erros NaN no gráfico de eficiência
[33ma048df9d[m fix: normalizar tipos e sanitizar gráfico para eliminar erros NaN
[33m98aa1a1b[m fix: sincronizar gráfico com todos os plantões e adicionar debug visual
[33m5ac6a67a[m fix: corrigir cor, dimensões e debug do gráfico de eficiência
[33mae010ac4[m fix: forçar re-render do gráfico e sincronizar dados com plantões
[33mfc8c9638[m fix: sanear dados do gráfico para eliminar erros NaN e adicionar fallbacks
[33mf1b651c1[m debug: adicionar logs para depurar gráfico de eficiência por hospital
[33mc17238f1[m feat: implementar gráfico de eficiência por hospital com recharts
[33mf50ff075[m refactor: remover botão redundante e refinar autocomplete do formulário da escala
[33m55cbadf1[m fix: adicionar função handleClearDay e corrigir estados do formulário da escala
[33mc1776944[m fix: arquivo page.tsx completamente reconstruido e limpo - versão 2.0
[33mc46e2bce[m fix: escala reconstruída do zero e 100% funcional
[33m899909ee[m fix: arquivo page.tsx completamente reconstruido e corrigido
[33m7d54e3bc[m feat: integração total do formulário de plantão no calendário com UX aprimorada
[33m47a3bc1d[m fix: unificando ícones e removendo bullets automáticos no calendário
[33mc86e338c[m style: visual final do calendário com pílulas e UX limpa
[33m9fbf3109[m fix: simplificando query do supabase e focando no core do calendario
[33mcf6bc45b[m fix: estruturando blocos try-catch e corrigindo sintaxe para deploy
[33m907052df[m debug: final force to expose data structure and fix 404
[33mafdeeb03[m fix: normalização de fuso horário e exibição final de status no calendário
[33m9aa1012a[m debug: rastreamento detalhado de correspondência de datas no calendário
[33m061ef435[m debug: adicionando logs detalhados para erro de inserção
[33mdc79085f[m feat: gestão total de calendário com limpeza e detecção de conflito
[33md6bdb376[m feat: garantindo versao completa do calendario interativo
[33m5b1e374a[m fix: supabase integration with fallback logic
[33m4a13ba25[m test: adicionando injetor de plantão de teste
[33m99456185[m feat: pagina de escala 100% funcional e reconstruida
[33mcda781a3[m feat: restaura sidebar e layout base estavel
[33m837dacaa[m refactor: reset total para diagnostico de tela branca
[33m6bf0b5c8[m test: botão de emergência e fundo cinza forçado
[33medc266dc[m fix: removendo loading state infinito e testando layout pai
[33md020ea13[m debug: adicionando bordas coloridas para teste de visibilidade
[33md0d30f80[m feat: layout visível mesmo sem plantões e tratamento de array vazio
[33mff9c9d35[m fix: cleanup icons to emojis and final build fix
[33m5517c94b[m fix: move use client to line 1 and clean imports
[33mea4f192d[m diagnostico: isolando erro de SVG
[33mf9ec5f8e[m fix: agora vai com o ponto
[33m7fcddb29[m diagnostico
[33mc3a6c93d[m fix: resolve component closure and final cleanup
[33m7a616f1c[m Fix syntax error in try/catch block - remove extra semicolon
[33mbc99c1a3[m Fix TypeScript compilation errors - resolve type issues and missing references
