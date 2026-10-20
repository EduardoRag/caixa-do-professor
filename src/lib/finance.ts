// Pure helpers for money, dates and competences (pt-BR). Money is always integer cents.

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Parses "150", "150,5", "1.234,56", "R$ 80,00" into integer cents. Returns null when invalid. */
export function parseBRLToCents(input: string): number | null {
  const raw = input.replace(/R\$\s?/i, "").replace(/\s/g, "").trim();
  if (!raw) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(raw)) return null;
  let normalized: string;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, "");
  else normalized = raw;
  const [intPart, decPart = ""] = normalized.split(".");
  const cents = Number(intPart) * 100 + Number((decPart + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // YYYY-MM-DD
}

export function currentCompetence(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function shiftCompetence(comp: string, delta: number): string {
  const [y, m] = comp.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export function competenceLabel(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export type PaymentStatus = "pendente" | "parcial" | "paga";

export function computeStatus(amountCents: number, paidCents: number, dueDate: string, today: string) {
  const balance = amountCents - paidCents;
  const payment: PaymentStatus = balance <= 0 ? "paga" : paidCents > 0 ? "parcial" : "pendente";
  const overdue = balance > 0 && dueDate < today;
  return { balance, payment, overdue };
}

export function onlyDigitsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  return digits;
}

export function isValidPhone(digits: string): boolean {
  return /^[0-9]{10,13}$/.test(digits);
}

export function whatsappNumber(digits: string): string {
  // Brazilian numbers without country code get 55 prefixed.
  return digits.length <= 11 ? `55${digits}` : digits;
}

export function buildChargeMessage(p: { name: string; competence: string; balanceCents: number; dueDate: string }) {
  const first = p.name.trim().split(/\s+/)[0];
  return `Olá, ${first}! Tudo bem? Passando para lembrar da mensalidade de ${competenceLabel(p.competence)}, com saldo em aberto de ${formatBRL(p.balanceCents)} (vencimento ${formatDateBR(p.dueDate)}). Qualquer dúvida, estou à disposição. Obrigado!`;
}

export function whatsappLink(digits: string, message: string): string {
  return `https://wa.me/${whatsappNumber(digits)}?text=${encodeURIComponent(message)}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  exceeds_balance: "O valor ultrapassa o saldo em aberto desta mensalidade.",
  invalid_amount: "Informe um valor válido maior que zero.",
  invalid_date: "Informe uma data válida.",
  invalid_method: "Escolha uma forma de pagamento válida.",
  invalid_competence: "Mês inválido.",
  already_paid: "Mensalidades já pagas não podem ser ajustadas.",
  below_paid: "O novo valor não pode ser menor que o total já recebido.",
  already_reversed: "Este lançamento já foi estornado.",
  not_found: "Registro não encontrado.",
  not_authenticated: "Sua sessão expirou. Entre novamente.",
};

export function friendlyError(err: unknown): string {
  const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "";
  const code = (err as { code?: string } | null)?.code;
  for (const key of Object.keys(ERROR_MESSAGES)) if (msg.includes(key)) return ERROR_MESSAGES[key];
  if (code === "23503") return "Este aluno possui histórico financeiro e não pode ser excluído. Inative-o.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
