import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { CompetencePicker } from "@/components/CompetencePicker";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusBadge } from "@/components/AppShell";
import { invoicesByCompetenceQuery, studentsQuery } from "@/lib/queries";
import { lessonDaysLabel, studentsForLessonDay } from "@/lib/lesson-days";
import { useLessonToday } from "@/hooks/use-lesson-today";
import { currentCompetence, formatBRL, formatDateBR } from "@/lib/finance";

const search = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });

export const Route = createFileRoute("/_authenticated/painel")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Painel — Caixa do Professor" },
      { name: "description", content: "Resumo financeiro do mês." },
      { property: "og:title", content: "Painel — Caixa do Professor" },
      { property: "og:description", content: "Resumo financeiro do mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { mes } = Route.useSearch();
  const competence = mes ?? currentCompetence();
  const navigate = Route.useNavigate();
  const { data, isLoading, isError } = useQuery(invoicesByCompetenceQuery(competence));
  const students = useQuery(studentsQuery());
  const today = useLessonToday();
  const todayStudents = today ? studentsForLessonDay(students.data ?? [], today.weekday) : [];

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

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><CalendarDays className="h-5 w-5 shrink-0 text-accent" /> Aulas de hoje</h2>
            <p className="mt-1 text-sm text-muted-foreground">{today?.label ?? "…"}</p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">{todayStudents.length} aluno{todayStudents.length === 1 ? "" : "s"}</span>
        </div>
        {students.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os alunos de hoje.</p> : students.isLoading || !today ? (
          <Skeleton className="h-24 w-full" />
        ) : todayStudents.length === 0 ? (
          <EmptyState title="Nenhum aluno com aula hoje" />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {todayStudents.map((student) => (
              <li key={student.id} className="flex min-w-0 items-center gap-3 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary font-display font-semibold text-accent">{student.name.trim().slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{[student.instrument, lessonDaysLabel(student.lesson_days)].filter(Boolean).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="min-w-0 space-y-3">
        <h2 className="font-display text-lg font-semibold">Cobranças em aberto</h2>
        {isError && <p className="text-sm text-destructive">Não foi possível carregar os dados.</p>}
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : open.length === 0 ? (
          <EmptyState title={rows.length ? "Tudo recebido neste mês 🎉" : "Nenhuma mensalidade neste mês"}>
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {open.map((r) => r.id ? (
              <li key={r.id}>
                <Link to="/mensalidades/$id" params={{ id: r.id }} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.student_name}</p>
                    <p className="text-xs text-muted-foreground">Vence {r.due_date ? formatDateBR(r.due_date) : "—"}</p>
                    <div className="mt-1"><StatusBadge status={r.payment_status ?? "pendente"} overdue={!!r.is_overdue} /></div>
                  </div>
                  <span className="tabular shrink-0 font-display font-semibold">{formatBRL(r.balance_cents ?? 0)}</span>
                </Link>
              </li>
            ) : null)}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, loading }: { label: string; value: string; tone?: "success" | "warning" | "destructive"; loading?: boolean }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-24" /> : <p className={`tabular mt-1 break-words font-display text-lg font-bold sm:text-xl ${color}`}>{value}</p>}
    </div>
  );
}
