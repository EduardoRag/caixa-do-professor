// Run: bun scripts/security-check.ts (needs server env). Creates two temporary teachers, checks money rules and cross-account isolation, then deletes them.
import { createClient } from "@supabase/supabase-js";
import { currentCompetence, shiftCompetence } from "../src/lib/finance";
const url = process.env.SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY, pub = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !svc || !pub) throw new Error("Missing server credentials");
const admin = createClient(url, svc, { auth: { persistSession: false } });
const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL ${m}`); console.log("PASS", m); };
const competence = currentCompetence();
const pw = "Teste-" + crypto.randomUUID();
const ids: string[] = [];
async function user(tag: string) {
  const email = `rls-${tag}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (error) throw error; ids.push(data.user.id);
  const c = createClient(url, pub, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password: pw }); if (s.error) throw s.error;
  return { c, id: data.user.id };
}
try {
  const A = await user("a"), B = await user("b");
  const ins = await A.c.from("students").insert({ teacher_id: B.id, name: "Ana", monthly_amount_cents: 20000, due_day: 10, phone: "11987654321", lesson_days: [1, 4] }).select().single();
  ok(ins.data?.teacher_id === A.id, "teacher_id forced to the signed-in teacher");
  ok(JSON.stringify(ins.data?.lesson_days) === "[1,4]", "multiple lesson days persist");
  if (!ins.data) throw new Error("Student creation failed");
  const sid = ins.data.id;
  const initial = await A.c.from("invoices").select("*").eq("student_id", sid).eq("competence", competence).single();
  ok(initial.data?.amount_cents === 20000 && initial.data?.due_date === `${competence}-10`, "new active student automatically receives current month's invoice");
  const invalidDays = await A.c.from("students").update({ lesson_days: [7] }).eq("id", sid);
  ok(!!invalidDays.error, "invalid weekday outside 0 through 6 rejected");
  await A.c.from("students").update({ lesson_days: [0, 5] }).eq("id", sid);
  const savedDays = await A.c.from("students").select("lesson_days").eq("id", sid).single();
  ok(JSON.stringify(savedDays.data?.lesson_days) === "[0,5]", "edited lesson days read back correctly");
  const g1 = await A.c.rpc("generate_invoices", { _competence: competence });
  const g2 = await A.c.rpc("generate_invoices", { _competence: competence });
  ok(g1.data === 0 && g2.data === 0, "repeated generation does not duplicate automatic invoice");
  await A.c.from("students").update({ monthly_amount_cents: 30000 }).eq("id", sid);
  const inv = (await A.c.from("invoices").select("*").single()).data!;
  ok(inv.amount_cents === 20000, "changing student amount keeps old invoice amount");
  const p1 = await A.c.rpc("register_payment", { _invoice_id: inv.id, _amount_cents: 5000, _paid_at: "2026-10-05", _method: "pix", _note: "" });
  ok(!p1.error, "partial payment accepted");
  const conc = await Promise.all([1, 2, 3].map(() => A.c.rpc("register_payment", { _invoice_id: inv.id, _amount_cents: 10000, _paid_at: "2026-10-05", _method: "pix", _note: "" })));
  ok(conc.filter((r) => !r.error).length === 1, "concurrent payments cannot exceed amount due");
  const sum = (await A.c.from("invoice_summaries").select("*").eq("id", inv.id).single()).data!;
  ok(sum.paid_cents === 15000 && sum.balance_cents === 5000 && sum.payment_status === "parcial", "balance = amount - paid");
  const direct = await A.c.from("payments").insert({ teacher_id: A.id, invoice_id: inv.id, amount_cents: 1, paid_at: "2026-10-05", method: "pix" });
  ok(!!direct.error, "direct payment insert blocked");
  await A.c.from("students").update({ is_active: false }).eq("id", sid);
  ok((await A.c.rpc("generate_invoices", { _competence: shiftCompetence(competence, 1) })).data === 0, "inactive students generate no invoices");
  const del = await A.c.from("students").delete().eq("id", sid);
  ok(!!del.error && (await A.c.from("students").select("id")).data!.length === 1, "student with history cannot be deleted");
  // Cross-account
  ok((await B.c.from("students").select("*").eq("id", sid)).data!.length === 0, "B cannot read A's student by id");
  ok((await B.c.from("invoice_summaries").select("*").eq("id", inv.id)).data!.length === 0, "B cannot read A's invoice by id");
  ok((await B.c.from("payments").select("*")).data!.length === 0, "B cannot read A's payments");
  ok((await B.c.from("audit_logs").select("*")).data!.length === 0, "B cannot read A's audit log");
  const bu = await B.c.from("students").update({ name: "hack", lesson_days: [2] }).eq("id", sid).select();
  ok((bu.data ?? []).length === 0, "B cannot update A's student");
  const afterCrossUpdate = await A.c.from("students").select("lesson_days").eq("id", sid).single();
  ok(JSON.stringify(afterCrossUpdate.data?.lesson_days) === "[0,5]", "B cannot change A's lesson days");
  const bd = await B.c.from("students").delete().eq("id", sid).select();
  ok((bd.data ?? []).length === 0, "B cannot delete A's student");
  ok(!!(await B.c.rpc("register_payment", { _invoice_id: inv.id, _amount_cents: 100, _paid_at: "2026-10-05", _method: "pix", _note: "" })).error, "B cannot pay A's invoice");
  ok(!!(await B.c.rpc("update_invoice", { _invoice_id: inv.id, _amount_cents: 100, _due_date: "2026-10-05" })).error, "B cannot edit A's invoice");
  const pid = (await A.c.from("payments").select("id").limit(1).single()).data!.id;
  ok(!!(await B.c.rpc("reverse_payment", { _payment_id: pid, _reason: "" })).error, "B cannot reverse A's payment");
  ok(!(await A.c.rpc("reverse_payment", { _payment_id: pid, _reason: "erro" })).error, "A can reverse own payment");
  const after = (await A.c.from("payments").select("*").eq("id", pid).single()).data!;
  ok(!!after.reversed_at, "reversed payment kept in history");
  const anon = createClient(url, pub, { auth: { persistSession: false } });
  ok(((await anon.from("students").select("*")).data ?? []).length === 0, "signed-out visitor sees nothing");
  ok(!!(await A.c.rpc("generate_current_month_invoices")).error, "teacher cannot call privileged all-account monthly job");
  ok(!!(await anon.rpc("generate_current_month_invoices")).error, "anonymous visitor cannot call monthly job");
  const inactive = await A.c.from("students").insert({ teacher_id: A.id, name: "Automatic test", monthly_amount_cents: 12000, due_day: 28, is_active: false }).select().single();
  if (!inactive.data) throw new Error("Inactive student creation failed");
  const inactiveId = inactive.data.id;
  const noInvoice = await A.c.from("invoices").select("id").eq("student_id", inactiveId);
  ok(noInvoice.data?.length === 0, "new inactive student receives no invoice");
  await A.c.from("students").update({ is_active: true }).eq("id", inactiveId);
  const activated = await A.c.from("invoices").select("*").eq("student_id", inactiveId).single();
  ok(activated.data?.amount_cents === 12000 && activated.data?.competence === competence, "reactivation automatically creates missing current invoice");
  await A.c.from("students").update({ is_active: false }).eq("id", inactiveId);
  await A.c.from("students").update({ is_active: true }).eq("id", inactiveId);
  ok((await A.c.from("invoices").select("id").eq("student_id", inactiveId)).data?.length === 1, "repeated activation never duplicates existing invoice");
  // Simulate a missing current-month invoice for an existing active student.
  const cleanup = await admin.from("invoices").delete().eq("student_id", inactiveId);
  if (cleanup.error) throw cleanup.error;
  const scheduled = await admin.rpc("generate_current_month_invoices");
  if (scheduled.error) throw scheduled.error;
  const scheduledInvoice = await A.c.from("invoices").select("*").eq("student_id", inactiveId).single();
  ok(scheduledInvoice.data?.amount_cents === 12000 && scheduledInvoice.data?.due_date === `${competence}-28`, "monthly job creates missing invoice without browser actions");
  const repeated = await admin.rpc("generate_current_month_invoices");
  ok(repeated.data === 0, "repeated monthly job is idempotent");
  const unchanged = await A.c.from("invoices").select("amount_cents").eq("id", inv.id).single();
  ok(unchanged.data?.amount_cents === 20000, "automatic job preserves historical invoice amount after student price change");
  ok((await B.c.from("invoices").select("id").eq("student_id", inactiveId)).data?.length === 0, "automatic invoices remain isolated across accounts");
} finally {
  for (const id of ids) {
    await admin.from("audit_logs").delete().eq("teacher_id", id);
    await admin.from("payments").delete().eq("teacher_id", id);
    await admin.from("invoices").delete().eq("teacher_id", id);
    await admin.from("students").delete().eq("teacher_id", id);
    await admin.auth.admin.deleteUser(id);
  }
}
