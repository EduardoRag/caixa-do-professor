# 🎓 Caixa do Professor

> Gestão financeira simplificada e objetiva para professores particulares.

O **Caixa do Professor** é uma aplicação web feita para professores autônomos (música, idiomas, reforço escolar, esportes, etc.) controlarem mensalidades, pagamentos e sua rotina de aulas sem a complexidade de planilhas manuais ou sistemas corporativos pesados.

---

## ✨ Principais Funcionalidades

- **Painel Financeiro em Tempo Real**:
  - Visão por competência mensal (mês/ano selecionável).
  - Indicadores automáticos: valor previsto, total recebido, saldo a receber e total em atraso.
- **Aulas de Hoje**:
  - Identificação dos alunos com aula no dia atual com base nos dias da semana definidos (fuso horário de Brasília).
- **Gestão de Alunos**:
  - Cadastro de contato, valor base de mensalidade e dia de vencimento.
  - Seleção dos dias da semana em que o aluno tem aula.
  - Controle de status (ativo/inativo).
- **Mensalidades Automáticas**:
  - Geração automática das mensalidades do mês para alunos ativos.
  - Criação imediata da primeira mensalidade ao cadastrar um novo aluno ativo.
  - Prevenção contra cobranças duplicadas.
- **Cobranças e Pagamentos**:
  - Registro de pagamentos totais ou parciais.
  - Estorno auditado de pagamentos com rastreamento de data e motivo.
  - Atalho para envio de lembrete de cobrança diretamente no WhatsApp do aluno.
- **Segurança e Integridade Financeira**:
  - Precisão contábil: todos os valores são processados e armazenados em centavos inteiros (sem erros de arredondamento de ponto flutuante).
  - Isolamento estrito entre professores via Row Level Security (RLS).
  - Operações financeiras controladas por funções seguras no banco de dados.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend & SSR**: [TanStack Start](https://tanstack.com/start) (React 19) com Vite
- **Estilização**: Tailwind CSS v4 + Radix UI / Shadcn
- **Tipografia**: Outfit (títulos) e Figtree (texto)
- **Backend & Banco de Dados**: Lovable Cloud (PostgreSQL com RLS e triggers de automação)
- **Testes & Segurança**: Vitest e script de validação de isolamento multi-tenant

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (v20+) ou [Bun](https://bun.sh/)

### Instalação e execução
```sh
# Instalar dependências
bun install # ou npm install

# Iniciar servidor de desenvolvimento
bun run dev # ou npm run dev
