import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import { BrandLockup } from "@/components/branding/BrandLockup";
import { BRAND_NAME, BRAND_SLOGAN_SECONDARY } from "@/branding/brand";

const LoginPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleGoogle = async () => {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result?.error) {
      toast({ title: "Erro ao entrar com Google", description: String(result.error), variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <BrandLockup theme="dark" showSlogan className="h-auto w-full max-w-[280px] mx-auto mb-5" />
          <h1 className="sr-only">{BRAND_NAME}</h1>
          <p className="text-sm text-muted-foreground mt-1">{BRAND_SLOGAN_SECONDARY}</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-3 bg-secondary hover:bg-accent text-foreground rounded-xl py-4 text-lg font-bold transition-colors disabled:opacity-50"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Entrar com Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full text-base py-4" autoComplete="email" />
          <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field w-full text-base py-4" autoComplete="current-password" />
          <button type="submit" disabled={submitting} className="w-full gradient-profit text-primary-foreground rounded-xl py-4 text-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            Entrar
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 text-sm">
          <Link to="/register" className="text-primary hover:underline font-medium">Criar conta</Link>
          <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">Esqueci a senha</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
