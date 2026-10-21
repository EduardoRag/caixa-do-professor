import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const studentsQuery = () =>
  queryOptions({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

export const invoicesByCompetenceQuery = (competence: string) =>
  queryOptions({
    queryKey: ["invoices", competence],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_summaries")
        .select("*")
        .eq("competence", competence)
        .order("due_date")
        .order("student_name");
      if (error) throw error;
      return data;
    },
  });

export const invoiceQuery = (id: string) =>
  queryOptions({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const [inv, pays, logs] = await Promise.all([
        supabase.from("invoice_summaries").select("*").eq("id", id).maybeSingle(),
        supabase.from("payments").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("*").eq("entity", "invoice").eq("entity_id", id).order("created_at", { ascending: false }),
      ]);
      if (inv.error) throw inv.error;
      if (pays.error) throw pays.error;
      if (logs.error) throw logs.error;
      return { invoice: inv.data, payments: pays.data, logs: logs.data };
    },
  });
