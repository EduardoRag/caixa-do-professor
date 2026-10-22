<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Money is stored as integer cents; never floats. Why: avoids rounding errors.
- Writes to invoices/payments/audit_logs happen only through SECURITY DEFINER database functions that check auth.uid(); clients have SELECT only. Why: overpayment and ownership checks must be atomic and not bypassable.
- teacher_id is set and frozen by database triggers/functions, never trusted from the browser. Why: prevents cross-account access.
- Status/balance come from the invoice_summaries view (security_invoker); "atrasada" is computed, never stored. Why: single source of truth.
- Run scripts/security-check.ts after changing schema or policies. Why: it exercises two-account isolation end to end.
