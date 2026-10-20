# MVP — Gestão Financeira para Professores

App mobile-first em pt-BR (BRL, datas dd/mm/aaaa) para professores controlarem alunos, mensalidades e pagamentos manuais. Sem dados fictícios, sem recursos extras.

## Telas
1. **/auth** — entrar, criar conta, esqueci a senha; **/reset-password** para nova senha.
2. **/painel** — seletor de competência (AAAA-MM), cards: previsto, recebido, saldo pendente, nº de inadimplentes; lista de pendentes/atrasadas; botão "Gerar mensalidades do mês".
3. **/alunos** — busca, lista, formulário de cadastro/edição (nome, WhatsApp, instrumento, valor mensal, dia 1–28, ativo/inativo).
4. **/mensalidades** — filtro por mês e status (pendente, parcial, paga, atrasada); **/mensalidades/$id** com detalhes, ajuste de valor/vencimento (se não paga), histórico de pagamentos, estorno com confirmação e "Cobrar pelo WhatsApp" (mensagem editável, abre wa.me).
5. **Registrar pagamento** — formulário em diálogo na tela de detalhe (valor, data, forma Pix/dinheiro/transferência/outro, observação).
- Página inicial `/` simples com chamada para entrar; navegação inferior no celular.

## Visual
Tom escuro e profissional: fundo grafite-arroxeado profundo, roxo vibrante como cor principal com destaques em lilás, tipografia Outfit + Figtree, números grandes e legíveis.

## Backend (Lovable Cloud)
- Login por e-mail/senha com confirmação por e-mail (padrão).
- Tabelas: students, invoices, payments, audit_logs — valores em centavos (inteiros).
- RLS em todas: SELECT/INSERT/UPDATE/DELETE apenas `teacher_id = auth.uid()`; sem acesso anônimo.
- `teacher_id` preenchido por trigger a partir de `auth.uid()` e imutável.
- Chaves compostas `(id, teacher_id)` em FK garantem aluno → mensalidade → pagamento do mesmo professor.
- UNIQUE (teacher_id, student_id, competence); CHECKs: valor > 0, dia 1–28, competência AAAA-MM.
- Funções no banco (security invoker, transacionais):
  - `generate_invoices(competence)` — insere para alunos ativos com `ON CONFLICT DO NOTHING`, copia o valor vigente.
  - `register_payment(invoice_id, amount, date, method, note)` — `SELECT ... FOR UPDATE` na mensalidade, recalcula saldo, rejeita excesso.
  - `reverse_payment(payment_id, reason)` — marca `reversed_at`, nunca apaga.
  - `update_invoice(...)` — só se não houver pagamento válido cobrindo o total; novo valor ≥ já pago.
  - View/função de resumo calculando pago, saldo e status (atrasada = saldo > 0 e vencida).
- Pagamentos não podem ser apagados nem editados diretamente (sem políticas de UPDATE/DELETE para o cliente; só via funções). Alunos com histórico não podem ser excluídos (FK RESTRICT); só inativados.
- audit_logs gravado pelas funções/triggers (criação, ajuste, estorno), sem dados sensíveis.
- Erros exibidos genéricos em português.

## Verificação
- Testes automatizados das regras: geração repetida não duplica; valor alterado do aluno não muda mensalidades antigas; inativo não gera; excesso de pagamento é rejeitado; cálculo de status/saldo.
- Teste de acesso cruzado com duas contas (leitura, criação, edição e exclusão por ID direto) via SQL.
- Fluxo ponta a ponta no navegador: cadastro → aluno → gerar mês → pagamento parcial e integral → painel.

## Pendências (comportamento conservador adotado)
- Mensalidade com pagamento parcial: ajuste permitido só para valor ≥ já pago.
- Exclusão de aluno sem histórico: permitida com confirmação.
