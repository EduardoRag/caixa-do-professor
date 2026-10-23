import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/AppShell";
import { studentsQuery } from "@/lib/queries";
import { LESSON_DAYS, lessonDaysLabel } from "@/lib/lesson-days";
import { centsToInput, formatBRL, friendlyError, isValidPhone, onlyDigitsPhone, parseBRLToCents } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/alunos")({
  head: () => ({
    meta: [
      { title: "Alunos — Caixa do Professor" },
      { name: "description", content: "Cadastro de alunos e valores mensais." },
      { property: "og:title", content: "Alunos — Caixa do Professor" },
      { property: "og:description", content: "Cadastro de alunos e valores mensais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Alunos,
});

type Student = Tables<"students">;

function Alunos() {
  const { data, isLoading, isError } = useQuery(studentsQuery());
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Student | null | "new">(null);

  const list = (data ?? []).filter((s) => {
    const t = q.trim().toLowerCase();
    return !t || s.name.toLowerCase().includes(t) || (s.instrument ?? "").toLowerCase().includes(t);
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h1 className="min-w-0 truncate font-display text-2xl font-bold">Alunos</h1>
        <Button className="shrink-0 bg-gradient-primary" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Novo aluno
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou instrumento" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isError && <p className="text-sm text-destructive">Não foi possível carregar os alunos.</p>}
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : list.length === 0 ? (
        <EmptyState title={data?.length ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}>
          {!data?.length && "Comece cadastrando seu primeiro aluno."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((s) => (
            <li key={s.id}>
              <Button variant="ghost" onClick={() => setEditing(s)} className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 whitespace-normal rounded-lg border border-border bg-card p-4 text-left hover:border-primary/60 hover:bg-card">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[s.instrument, `vence dia ${s.due_day}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-accent">{lessonDaysLabel(s.lesson_days) || "Dias não definidos"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular font-display font-semibold">{formatBRL(s.monthly_amount_cents)}</p>
                  {!s.is_active && <span className="text-xs text-muted-foreground">Inativo</span>}
                </div>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <StudentDialog student={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StudentDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(student?.name ?? "");
  const [phone, setPhone] = useState(student?.phone ?? "");
  const [instrument, setInstrument] = useState(student?.instrument ?? "");
  const [amount, setAmount] = useState(student ? centsToInput(student.monthly_amount_cents) : "");
  const [dueDay, setDueDay] = useState(String(student?.due_day ?? 10));
  const [active, setActive] = useState(student?.is_active ?? true);
  const [lessonDays, setLessonDays] = useState<number[]>(student?.lesson_days ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      if (!n || n.length > 120) throw new Error("Informe o nome do aluno.");
      const cents = parseBRLToCents(amount);
      if (!cents) throw new Error("Informe um valor mensal válido.");
      const day = Number(dueDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error("O dia de vencimento deve ser entre 1 e 28.");
      const digits = onlyDigitsPhone(phone);
      if (digits && !isValidPhone(digits)) throw new Error("Telefone inválido. Use DDD + número.");
      const payload = {
        name: n,
        phone: digits,
        instrument: instrument.trim().slice(0, 60) || null,
        monthly_amount_cents: cents,
        due_day: day,
        is_active: active,
        lesson_days: lessonDays,
      };
      if (student) {
        const { error } = await supabase.from("students").update(payload).eq("id", student.id);
        if (error) throw error;
      } else {
        // teacher_id is set by the database from the session; the placeholder is overwritten.
        const { error } = await supabase.from("students").insert({ ...payload, teacher_id: "00000000-0000-0000-0000-000000000000" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Aluno salvo.");
      qc.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error && !("code" in e) ? e.message : friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!student) throw new Error("Aluno não encontrado.");
      const { error } = await supabase.from("students").delete().eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno excluído.");
      qc.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (e) => {
      setConfirmDelete(false);
      toast.error(friendlyError(e));
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{student ? "Editar aluno" : "Novo aluno"}</DialogTitle>
        </DialogHeader>
        <form id="student-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input id="phone" inputMode="tel" placeholder="11 98765-4321" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instrument">Instrumento</Label>
              <Input id="instrument" maxLength={60} value={instrument} onChange={(e) => setInstrument(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor mensal (R$) *</Label>
              <Input id="amount" inputMode="decimal" placeholder="200,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Dia de vencimento *</Label>
              <Input id="due" type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Dias de aula</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {LESSON_DAYS.map((day) => (
                <div key={day.value} className="flex min-w-0 items-center gap-2">
                  <Checkbox id={`lesson-day-${day.value}`} checked={lessonDays.includes(day.value)} onCheckedChange={(checked) => setLessonDays((days) => checked === true ? [...days, day.value].sort((a, b) => a - b) : days.filter((value) => value !== day.value))} />
                  <Label htmlFor={`lesson-day-${day.value}`} className="cursor-pointer text-sm">{day.label}</Label>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-secondary p-3">
            <div>
              <Label htmlFor="active">Aluno ativo</Label>
              <p className="text-xs text-muted-foreground">Inativos não geram novas mensalidades.</p>
            </div>
            <Switch id="active" checked={active} onCheckedChange={setActive} />
          </div>
          {student && <p className="text-xs text-muted-foreground">Alterar o valor vale só para mensalidades futuras.</p>}
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {student ? (
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>Excluir</Button>
          ) : <span />}
          <Button type="submit" form="student-form" className="bg-gradient-primary" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir alunos sem mensalidades. Com histórico, prefira inativar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove.mutate(); }} disabled={remove.isPending}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
