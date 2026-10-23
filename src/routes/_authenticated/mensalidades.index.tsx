import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusBadge } from "@/components/AppShell";
import { CompetencePicker } from "@/components/CompetencePicker";
import { invoicesByCompetenceQuery } from "@/lib/queries";
import { currentCompetence, formatBRL, formatDateBR } from "@/lib/finance";

const FILTERS = ["todas", "pendente", "parcial", "paga", "atrasada"] as const;
type Filter = (typeof FILTERS)[number];

const search = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  status: z.enum(FILTERS).optional(),
});

export const Route = createFileRoute("/_authenticated/mensalidades/")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Mensalidades — Caixa do Professor" },
      { name: "description", content: "Mensalidades do mês por status." },
      { property: "og:title", content: "Mensalidades — Caixa do Professor" },
      { property: "og:description", content: "Mensalidades do mês por status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Mensalidades,
});

const LABELS: Record<Filter, string> = { todas: "Todas", pendente: "Pendentes", parcial: "Parciais", paga: "Pagas", atrasada: "Atrasadas" };

function Mensalidades() {
  const { mes, status = "todas" } = Route.useSearch();
  const competence = mes ?? currentCompetence();
  const navigate = Route.useNavigate();
  const { data, isLoading, isError } = useQuery(invoicesByCompetenceQuery(competence));

  const rows = (data ?? []).filter((r) =>
    status === "todas" ? true : status === "atrasada" ? r.is_overdue : r.payment_status === status,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Mensalidades</h1>
        <CompetencePicker value={competence} onChange={(v) => navigate({ search: { mes: v, status } })} />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => navigate({ search: { mes: competence, status: f } })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${status === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {LABELS[f]}
          </button>
        ))}
      </div>
      {isError && <p className="text-sm text-destructive">Não foi possível carregar as mensalidades.</p>}
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma mensalidade encontrada">Gere as mensalidades do mês pelo Painel.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to="/mensalidades/$id" params={{ id: r.id! }} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.student_name}</p>
                  <p className="text-xs text-muted-foreground">Vence {formatDateBR(r.due_date!)}</p>
                  <div className="mt-1"><StatusBadge status={r.payment_status!} overdue={!!r.is_overdue} /></div>
                </div>
                <div className="text-right">
                  <p className="tabular font-display font-semibold">{formatBRL(r.amount_cents!)}</p>
                  {(r.balance_cents ?? 0) > 0 && (r.paid_cents ?? 0) > 0 && (
                    <p className="tabular text-xs text-muted-foreground">falta {formatBRL(r.balance_cents!)}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
