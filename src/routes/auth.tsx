import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Caixa do Professor" },
      { name: "description", content: "Entre ou crie sua conta no Caixa do Professor." },
      { property: "og:title", content: "Entrar — Caixa do Professor" },
      { property: "og:description", content: "Entre ou crie sua conta no Caixa do Professor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";
const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passwordSchema = z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72);

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setInfo(null);
    const em = emailSchema.safeParse(email);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (mode !== "forgot") {
      const pw = passwordSchema.safeParse(password);
      if (!pw.success) return toast.error(pw.error.issues[0].message);
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password });
        if (error) throw error;
        navigate({ to: "/painel", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: em.data,
          password,
          options: { emailRedirectTo: window.location.origin + "/painel" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/painel", replace: true });
        else setInfo("Conta criada! Confira seu e-mail e clique no link de confirmação para entrar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(em.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
      }
    } catch {
      toast.error(mode === "signin" ? "E-mail ou senha incorretos, ou e-mail ainda não confirmado." : "Não foi possível concluir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = { signin: "Entrar", signup: "Criar conta", forgot: "Recuperar senha" };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-glow">
        <span className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary font-display font-bold text-primary-foreground">CP</span>
        <h1 className="font-display text-2xl font-bold">{titles[mode]}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}
          {info && <p className="rounded-md bg-secondary p-3 text-sm">{info}</p>}
          <Button type="submit" className="w-full bg-gradient-primary" disabled={busy}>
            {busy ? "Aguarde…" : titles[mode]}
          </Button>
        </form>
        <div className="mt-4 flex flex-col gap-2 text-center text-sm text-muted-foreground">
          {mode === "signin" && (
            <>
              <button type="button" className="hover:text-foreground" onClick={() => { setMode("forgot"); setInfo(null); }}>Esqueci minha senha</button>
              <button type="button" className="hover:text-foreground" onClick={() => { setMode("signup"); setInfo(null); }}>Não tem conta? <span className="text-accent">Criar conta</span></button>
            </>
          )}
          {mode !== "signin" && (
            <button type="button" className="hover:text-foreground" onClick={() => { setMode("signin"); setInfo(null); }}>Já tenho conta — entrar</button>
          )}
        </div>
      </div>
    </div>
  );
}
