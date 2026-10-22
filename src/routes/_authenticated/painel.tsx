import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { CompetencePicker } from "@/components/CompetencePicker";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusBadge } from "@/components/AppShell";
import { invoicesByCompetenceQuery } from "@/lib/queries";
import { currentCompetence, formatBRL, formatDateBR, friendlyError } from "@/lib/finance";

const search = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });

export const Route = createFileRoute("/_authenticated/painel")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Painel — Caixa do Professor" },
      { name: "description", content: "Resumo financeiro do mês." },
      { property: "og:title", content: "Painel — Caixa do Professor" },
      { property: "og:description", content: "Resumo financeiro do mês." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { mes } = Route.useSearch();
  const competence = mes ?? currentCompetence();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery(invoicesByCompetenceQuery(competence));

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_invoices", { _competence: competence });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} mensalidade(s) gerada(s).` : "Nenhuma mensalidade nova — todas já existem.");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const rows = data ?? [];
  const expected = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const received = rows.reduce((s, r) => s + (r.paid_cents ?? 0), 0);
  const pending = rows.reduce((s, r) => s + Math.max(0, r.balance_cents ?? 0), 0);
  const overdueStudents = new Set(rows.filter((r) => r.is_overdue).map((r) => r.student_id)).size;
  const open = rows.filter((r) => (r.balance_cents ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Painel</h1>
        <CompetencePicker value={competence} onChange={(v) => navigate({ search: { mes: v } })} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Previsto" value={formatBRL(expected)} loading={isLoading} />
        <Stat label="Recebido" value={formatBRL(received)} tone="success" loading={isLoading} />
        <Stat label="Saldo pendente" value={formatBRL(pending)} tone="warning" loading={isLoading} />
        <Stat label="Inadimplentes" value={String(overdueStudents)} tone="destructive" loading={isLoading} />
      </div>

      <Button className="w-full bg-gradient-primary shadow-glow sm:w-auto" onClick={() => generate.mutate()} disabled={generate.isPending}>
        <Sparkles className="h-4 w-4" />
        {generate.isPending ? "Gerando…" : "Gerar mensalidades do mês"}
      </Button>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Cobranças em aberto</h2>
        {isError && <p className="text-sm text-destructive">Não foi possível carregar os dados.</p>}
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : open.length === 0 ? (
          <EmptyState title={rows.length ? "Tudo recebido neste mês 🎉" : "Nenhuma mensalidade neste mês"}>
            {!rows.length && "Cadastre alunos e use “Gerar mensalidades do mês”."}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {open.map((r) => (
              <li key={r.id}>
                <Link to="/mensalidades/$id" params={{ id: r.id! }} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.student_name}</p>
                    <p className="text-xs text-muted-foreground">Vence {formatDateBR(r.due_date!)}</p>
                    <div className="mt-1"><StatusBadge status={r.payment_status!} overdue={!!r.is_overdue} /></div>
                  </div>
                  <span className="tabular font-display font-semibold">{formatBRL(r.balance_cents!)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone, loading }: { label: string; value: string; tone?: "success" | "warning" | "destructive"; loading?: boolean }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-24" /> : <p className={`tabular mt-1 font-display text-xl font-bold ${color}`}>{value}</p>}
    </div>
  );
}
