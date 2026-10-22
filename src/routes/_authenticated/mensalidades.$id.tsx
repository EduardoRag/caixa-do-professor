import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageCircle, Pencil, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, StatusBadge } from "@/components/AppShell";
import { invoiceQuery } from "@/lib/queries";
import {
  buildChargeMessage, centsToInput, competenceLabel, formatBRL, formatDateBR, friendlyError, parseBRLToCents, todayISO, whatsappLink,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/mensalidades/$id")({
  head: () => ({
    meta: [
      { title: "Mensalidade — Caixa do Professor" },
      { name: "description", content: "Detalhes, pagamentos e cobrança da mensalidade." },
      { property: "og:title", content: "Mensalidade — Caixa do Professor" },
      { property: "og:description", content: "Detalhes, pagamentos e cobrança da mensalidade." },
    ],
  }),
  component: Detalhe,
});

const METHODS: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência", outro: "Outro" };
type Dlg = null | "pay" | "edit" | "whats" | { reverse: string };

function Detalhe() {
  const { id } = Route.useParams();
  const { data, isLoading, isError } = useQuery(invoiceQuery(id));
  const [dlg, setDlg] = useState<Dlg>(null);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data?.invoice) {
    return (
      <EmptyState title="Mensalidade não encontrada">
        <Link to="/mensalidades" className="text-accent">Voltar às mensalidades</Link>
      </EmptyState>
    );
  }
  const inv = data.invoice;
  const balance = inv.balance_cents ?? 0;

  return (
    <div className="space-y-6">
      <Link to="/mensalidades" search={{ mes: inv.competence! }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mensalidades
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-glow">
        <p className="text-sm capitalize text-muted-foreground">{competenceLabel(inv.competence!)}</p>
        <h1 className="font-display text-2xl font-bold">{inv.student_name}</h1>
        <div className="mt-2"><StatusBadge status={inv.payment_status!} overdue={!!inv.is_overdue} /></div>
        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Valor</dt><dd className="tabular font-display text-lg font-semibold">{formatBRL(inv.amount_cents!)}</dd></div>
          <div><dt className="text-muted-foreground">Recebido</dt><dd className="tabular font-display text-lg font-semibold text-success">{formatBRL(inv.paid_cents!)}</dd></div>
          <div><dt className="text-muted-foreground">Saldo</dt><dd className="tabular font-display text-lg font-semibold text-warning">{formatBRL(Math.max(0, balance))}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">Vencimento: {formatDateBR(inv.due_date!)}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Button className="bg-gradient-primary" disabled={balance <= 0} onClick={() => setDlg("pay")}><Plus className="h-4 w-4" /> Registrar pagamento</Button>
          <Button variant="secondary" disabled={balance <= 0 || !inv.student_phone} onClick={() => setDlg("whats")}><MessageCircle className="h-4 w-4" /> Cobrar pelo WhatsApp</Button>
          <Button variant="secondary" disabled={balance <= 0} onClick={() => setDlg("edit")}><Pencil className="h-4 w-4" /> Ajustar</Button>
        </div>
        {balance > 0 && !inv.student_phone && <p className="mt-2 text-xs text-muted-foreground">Cadastre o WhatsApp do aluno para cobrar por lá.</p>}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Pagamentos</h2>
        {data.payments.length === 0 ? (
          <EmptyState title="Nenhum pagamento registrado" />
        ) : (
          <ul className="space-y-2">
            {data.payments.map((p) => (
              <li key={p.id} className={`flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 ${p.reversed_at ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <p className={`tabular font-display font-semibold ${p.reversed_at ? "line-through" : ""}`}>{formatBRL(p.amount_cents)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateBR(p.paid_at)} · {METHODS[p.method] ?? p.method}</p>
                  {p.note && <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>}
                  {p.reversed_at && <p className="mt-1 text-xs text-destructive">Estornado em {formatDateBR(p.reversed_at)}{p.reversal_reason ? ` — ${p.reversal_reason}` : ""}</p>}
                </div>
                {!p.reversed_at && (
                  <Button variant="ghost" size="sm" onClick={() => setDlg({ reverse: p.id })}><Undo2 className="h-4 w-4" /> Estornar</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.logs.some((l) => l.action === "update") && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Histórico de ajustes</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {data.logs.filter((l) => l.action === "update").map((l) => {
              const m = l.metadata as Record<string, string | number>;
              return (
                <li key={l.id}>
                  {formatDateBR(l.created_at)}: {formatBRL(Number(m["old_amount_cents"]))} → {formatBRL(Number(m["new_amount_cents"]))}, venc. {formatDateBR(String(m["old_due_date"]))} → {formatDateBR(String(m["new_due_date"]))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {dlg === "pay" && <PayDialog invoiceId={id} balance={balance} onClose={() => setDlg(null)} />}
      {dlg === "edit" && <EditDialog invoiceId={id} amount={inv.amount_cents!} dueDate={inv.due_date!} onClose={() => setDlg(null)} />}
      {dlg === "whats" && (
        <WhatsDialog
          phone={inv.student_phone!}
          initial={buildChargeMessage({ name: inv.student_name!, competence: inv.competence!, balanceCents: balance, dueDate: inv.due_date! })}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg && typeof dlg === "object" && <ReverseDialog invoiceId={id} paymentId={dlg.reverse} onClose={() => setDlg(null)} />}
    </div>
  );
}

function useInvalidate(invoiceId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };
}

function PayDialog({ invoiceId, balance, onClose }: { invoiceId: string; balance: number; onClose: () => void }) {
  const invalidate = useInvalidate(invoiceId);
  const [amount, setAmount] = useState(centsToInput(balance));
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState("pix");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const cents = parseBRLToCents(amount);
      if (!cents) throw new Error("invalid_amount");
      if (cents > balance) throw new Error("exceeds_balance");
      const { error } = await supabase.rpc("register_payment", {
        _invoice_id: invoiceId, _amount_cents: cents, _paid_at: date, _method: method, _note: note.trim().slice(0, 500),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pagamento registrado."); invalidate(); onClose(); },
    onError: (e) => { toast.error(friendlyError(e)); invalidate(); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
        <form id="pay" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!m.isPending) m.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="amt">Valor (R$)</Label><Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="dt">Data</Label><Input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Saldo em aberto: {formatBRL(balance)}</p>
          <div className="space-y-2">
            <Label>Forma</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="note">Observação</Label><Textarea id="note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </form>
        <DialogFooter><Button type="submit" form="pay" className="bg-gradient-primary" disabled={m.isPending}>{m.isPending ? "Salvando…" : "Registrar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ invoiceId, amount, dueDate, onClose }: { invoiceId: string; amount: number; dueDate: string; onClose: () => void }) {
  const invalidate = useInvalidate(invoiceId);
  const [value, setValue] = useState(centsToInput(amount));
  const [date, setDate] = useState(dueDate);
  const m = useMutation({
    mutationFn: async () => {
      const cents = parseBRLToCents(value);
      if (!cents) throw new Error("invalid_amount");
      const { error } = await supabase.rpc("update_invoice", { _invoice_id: invoiceId, _amount_cents: cents, _due_date: date });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mensalidade ajustada."); invalidate(); onClose(); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajustar mensalidade</DialogTitle></DialogHeader>
        <form id="edit" className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); if (!m.isPending) m.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="v">Valor (R$)</Label><Input id="v" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="d">Vencimento</Label><Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </form>
        <p className="text-xs text-muted-foreground">O ajuste fica registrado no histórico.</p>
        <DialogFooter><Button type="submit" form="edit" className="bg-gradient-primary" disabled={m.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReverseDialog({ invoiceId, paymentId, onClose }: { invoiceId: string; paymentId: string; onClose: () => void }) {
  const invalidate = useInvalidate(invoiceId);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reverse_payment", { _payment_id: paymentId, _reason: reason.trim().slice(0, 300) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pagamento estornado."); invalidate(); onClose(); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Estornar pagamento?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">O lançamento continua no histórico, marcado como estornado, e o saldo volta a ficar em aberto.</p>
        <div className="space-y-2"><Label htmlFor="r">Motivo (opcional)</Label><Input id="r" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>Confirmar estorno</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WhatsDialog({ phone, initial, onClose }: { phone: string; initial: string; onClose: () => void }) {
  const [msg, setMsg] = useState(initial);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mensagem de cobrança</DialogTitle></DialogHeader>
        <Textarea rows={6} maxLength={1000} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <p className="text-xs text-muted-foreground">Nada é enviado automaticamente: o WhatsApp abrirá com a mensagem para você revisar e enviar.</p>
        <DialogFooter>
          <Button asChild className="bg-gradient-primary">
            <a href={whatsappLink(phone, msg)} target="_blank" rel="noopener noreferrer" onClick={onClose}>Abrir WhatsApp</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
