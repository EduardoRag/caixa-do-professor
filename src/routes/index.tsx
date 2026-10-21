import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Caixa do Professor — mensalidades sem planilha" },
      { name: "description", content: "Controle alunos, mensalidades e pagamentos das suas aulas particulares em um só lugar." },
      { property: "og:title", content: "Caixa do Professor — mensalidades sem planilha" },
      { property: "og:description", content: "Controle alunos, mensalidades e pagamentos das suas aulas particulares em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
      <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <span className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary font-display text-lg font-bold text-primary-foreground shadow-glow">CP</span>
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
          Suas mensalidades, <span className="text-accent">em dia.</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Cadastre alunos, gere as cobranças do mês, registre o que recebeu e veja quem ainda falta pagar.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
            <Link to="/auth">Entrar ou criar conta</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
